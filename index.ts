import * as ExcelJS from "exceljs";
import "dotenv/config";
import { Worker } from "worker_threads";

// Performance configuration
const PERFORMANCE_CONFIG = {
  // Number of customer IDs to process in parallel
  WALLET_GENERATION_BATCH_SIZE: parseInt(
    process.env.WALLET_BATCH_SIZE || "100"
  ),
  // Number of rows to process when reading Excel
  EXCEL_READ_BATCH_SIZE: parseInt(process.env.EXCEL_READ_BATCH_SIZE || "1000"),
  // Number of rows to write to Excel at once
  EXCEL_WRITE_BATCH_SIZE: parseInt(
    process.env.EXCEL_WRITE_BATCH_SIZE || "1000"
  ),
  // Show progress indicators for datasets larger than this
  PROGRESS_THRESHOLD: parseInt(process.env.PROGRESS_THRESHOLD || "1000"),
  NUM_THREADS: parseInt(process.env.NUM_THREADS || "4"),
};

// Get seed phrase from environment variable
const seed_phrase = process.env.CUSTOMERS_HDNODE_WALLET_PHRASE;

if (!seed_phrase) {
  throw new Error(
    "CUSTOMERS_HDNODE_WALLET_PHRASE environment variable is not set in .env file"
  );
}

// Read input.xlsx file
async function readCustomerIds(): Promise<string[]> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("input.xlsx");

    const worksheet = workbook.getWorksheet(1); // Get the first worksheet
    if (!worksheet) {
      throw new Error("No worksheet found in input.xlsx");
    }

    // Extract customer IDs from the data
    const customerIds: string[] = [];

    // Get headers from the first row
    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell: ExcelJS.Cell, colNumber: number) => {
      headers[colNumber - 1] = cell.value?.toString() || "";
    });

    // Find the customer ID column
    let customerIdColumnIndex = -1;
    const possibleColumnNames = [
      "Customer ID",
      "customerId",
      "CustomerID",
      "customer_id",
      "customerID",
      "CustomerId",
    ];

    for (let i = 0; i < headers.length; i++) {
      if (possibleColumnNames.includes(headers[i])) {
        customerIdColumnIndex = i + 1; // ExcelJS uses 1-based indexing
        break;
      }
    }

    if (customerIdColumnIndex === -1) {
      throw new Error(
        "Customer ID column not found. Please check the column name."
      );
    }

    // Read customer IDs from the column - optimized for performance
    const totalRows = worksheet.rowCount;
    console.log(`Reading ${totalRows - 1} rows from Excel file...`);

    // Use a more efficient approach for large datasets
    for (let rowNumber = 2; rowNumber <= totalRows; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const cell = row.getCell(customerIdColumnIndex);
      const customerId = cell.value?.toString();

      if (customerId && customerId.trim()) {
        customerIds.push(customerId.trim());
      }

      // Progress indicator for large files
      if (totalRows > 1000 && rowNumber % 1000 === 0) {
        console.log(`Read ${rowNumber}/${totalRows} rows...`);
      }
    }

    if (customerIds.length === 0) {
      throw new Error(
        "No customer IDs found in input.xlsx. Please check the column name."
      );
    }

    console.log(`Found ${customerIds.length} customer IDs in input.xlsx`);
    return customerIds;
  } catch (error) {
    console.error("Error reading input.xlsx:", error);
    throw error;
  }
}

// Generate wallet addresses for all customer IDs using worker threads
async function generateWallets(customerIds: string[]): Promise<any[]> {
  const numThreads = PERFORMANCE_CONFIG.NUM_THREADS;
  const batchSize = Math.ceil(customerIds.length / numThreads);
  const seedPhrase = process.env.CUSTOMERS_HDNODE_WALLET_PHRASE;
  const workerPath = require("path").resolve(
    __dirname,
    "../dist/src/walletWorker.js"
  );

  const promises: Promise<any[]>[] = [];
  for (let i = 0; i < customerIds.length; i += batchSize) {
    const batch = customerIds.slice(i, i + batchSize);
    promises.push(
      new Promise((resolve, reject) => {
        const worker = new Worker(workerPath, {
          workerData: { customerIds: batch, seedPhrase },
        });
        worker.on("message", resolve);
        worker.on("error", reject);
        worker.on("exit", (code) => {
          if (code !== 0)
            reject(new Error(`Worker stopped with exit code ${code}`));
        });
      })
    );
  }
  // Wait for all workers to finish and flatten results
  const results = (await Promise.all(promises)).flat();
  return results;
}

// Export results to output.xlsx
async function exportToXlsx(data: any[]) {
  console.log(`Exporting ${data.length} records to Excel...`);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Customer Wallets");

  // Add headers
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
  }

  // Add data rows in batches for better performance
  const batchSize = PERFORMANCE_CONFIG.EXCEL_WRITE_BATCH_SIZE;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    // Add rows in batch
    batch.forEach((row) => {
      const rowData = Object.values(row);
      worksheet.addRow(rowData);
    });

    // Progress indicator for large datasets
    if (
      data.length > PERFORMANCE_CONFIG.PROGRESS_THRESHOLD &&
      i % PERFORMANCE_CONFIG.PROGRESS_THRESHOLD === 0
    ) {
      console.log(
        `Exported ${Math.min(i + batchSize, data.length)}/${
          data.length
        } records...`
      );
    }
  }

  // Write to file
  const filename = "output.xlsx";
  await workbook.xlsx.writeFile(filename);

  console.log(`\nXLSX file exported successfully: ${filename}`);
  console.log(`Total records processed: ${data.length}`);
}

// Main execution
async function main() {
  console.log("Starting wallet generation process...");

  // Read customer IDs from input file
  const customerIds = await readCustomerIds();

  // Generate wallets for all customers
  const results = await generateWallets(customerIds);

  // Export results to output file
  await exportToXlsx(results);

  console.log("Process completed successfully!");
}

// Run the main function
main();
