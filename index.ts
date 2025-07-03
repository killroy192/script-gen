import { CustomerWalletService } from "./src/CustomerWalletService";
import * as ExcelJS from "exceljs";
import "dotenv/config";
import { Worker } from "worker_threads";

// Performance configuration
const PERFORMANCE_CONFIG = {
  // Number of rows to process when reading Excel
  EXCEL_READ_BATCH_SIZE: parseInt(process.env.EXCEL_READ_BATCH_SIZE || "2000"),
  // Number of rows to write to Excel at once
  EXCEL_WRITE_BATCH_SIZE: parseInt(
    process.env.EXCEL_WRITE_BATCH_SIZE || "2000"
  ),
  // Show progress indicators for datasets larger than this
  NUM_THREADS: parseInt(process.env.NUM_THREADS || "4"),
};

// Get seed phrase from environment variable
const seed_phrase = process.env.CUSTOMERS_HDNODE_WALLET_PHRASE;

if (!seed_phrase) {
  throw new Error(
    "CUSTOMERS_HDNODE_WALLET_PHRASE environment variable is not set in .env file"
  );
}

// Read input.xlsx file using streaming for better performance
async function readCustomerIds(): Promise<string[]> {
  try {
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader("input.xlsx", {});
    const customerIds: string[] = [];
    let headers: string[] = [];
    let customerIdColumnIndex = -1;
    let rowCount = 0;

    console.log("Reading Excel file using streaming...");

    for await (const worksheetReader of workbook) {
      for await (const row of worksheetReader) {
        rowCount++;

        // First row contains headers
        if (rowCount === 1) {
          headers = row.values as string[];

          // Find the customer ID column
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
              customerIdColumnIndex = i;
              break;
            }
          }

          if (customerIdColumnIndex === -1) {
            throw new Error(
              "Customer ID column not found. Please check the column name."
            );
          }

          console.log(
            `Found Customer ID column at index ${customerIdColumnIndex}`
          );
          continue;
        }

        // Process data rows
        const values = row.values as any[];
        const customerId = values[customerIdColumnIndex]?.toString();
        if (customerId && customerId.trim()) {
          customerIds.push(customerId.trim());
        }
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

// Generate wallet addresses for a batch of customer IDs using worker threads
async function generateWallets(customerIds: string[]): Promise<any[]> {
  // For smaller batches, use fewer threads to avoid overhead
  const numThreads = Math.min(
    PERFORMANCE_CONFIG.NUM_THREADS,
    Math.max(1, Math.ceil(customerIds.length / 100))
  );
  const batchSize = Math.ceil(customerIds.length / numThreads);
  const seedPhrase = process.env.CUSTOMERS_HDNODE_WALLET_PHRASE;
  const workerPath = require("path").resolve(
    __dirname,
    "../dist/src/walletWorker.js"
  );

  // If batch is small enough, process directly without workers
  if (customerIds.length < 50) {
    const customerWalletService = new CustomerWalletService(seedPhrase!);
    const results: any[] = [];
    const customerToWalletMap: { [key: string]: string } = {};

    for (const customerId of customerIds) {
      try {
        if (customerToWalletMap[customerId]) {
          throw new Error(`Duplicated Customer ID`);
        }
        const walletAddress =
          customerWalletService.getCustomerWalletAddress(customerId);
        customerToWalletMap[customerId] = walletAddress;
        results.push({
          "Customer ID": customerId,
          "Wallet Address": walletAddress,
        });
      } catch (error) {
        results.push({
          "Customer ID": customerId,
          "Wallet Address": "ERROR",
          Error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return results;
  }

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

// Export results to output.xlsx using streaming for better performance
async function exportToXlsx(data: any[]) {
  console.log(`Exporting ${data.length} records to Excel using streaming...`);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: "output.xlsx",
    useStyles: false,
    useSharedStrings: false,
  });

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
  }

  // Commit the worksheet and close the workbook
  await worksheet.commit();
  await workbook.commit();

  console.log(`\nXLSX file exported successfully: output.xlsx`);
  console.log(`Total records processed: ${data.length}`);
}

// Pipeline approach: read and process in batches
async function processCustomerIdsInBatches(): Promise<any[]> {
  const batchSize = PERFORMANCE_CONFIG.EXCEL_READ_BATCH_SIZE;
  const allResults: any[] = [];
  let batchNumber = 0;

  try {
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader("input.xlsx", {});
    let headers: string[] = [];
    let customerIdColumnIndex = -1;
    let rowCount = 0;
    let currentBatch: string[] = [];

    console.log(
      "Starting pipeline processing: read → compute → read → compute..."
    );

    for await (const worksheetReader of workbook) {
      for await (const row of worksheetReader) {
        rowCount++;

        // First row contains headers
        if (rowCount === 1) {
          headers = row.values as string[];

          // Find the customer ID column
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
              customerIdColumnIndex = i;
              break;
            }
          }

          if (customerIdColumnIndex === -1) {
            throw new Error(
              "Customer ID column not found. Please check the column name."
            );
          }

          console.log(
            `Found Customer ID column at index ${customerIdColumnIndex}`
          );
          continue;
        }

        // Process data rows
        const values = row.values as any[];
        const customerId = values[customerIdColumnIndex]?.toString();
        if (customerId && customerId.trim()) {
          currentBatch.push(customerId.trim());
        }

        // Process batch when it reaches the target size
        if (currentBatch.length >= batchSize) {
          batchNumber++;
          console.log(
            `Processing batch ${batchNumber} (${currentBatch.length} customer IDs)...`
          );

          const batchResults = await generateWallets(currentBatch);
          allResults.push(...batchResults);

          // Clear the batch for next iteration
          currentBatch = [];
        }
      }
    }

    // Process any remaining customer IDs in the final batch
    if (currentBatch.length > 0) {
      batchNumber++;
      console.log(
        `Processing final batch ${batchNumber} (${currentBatch.length} customer IDs)...`
      );

      const batchResults = await generateWallets(currentBatch);
      allResults.push(...batchResults);
    }

    console.log(
      `Pipeline processing completed. Total batches: ${batchNumber}, Total customer IDs: ${allResults.length}`
    );
    return allResults;
  } catch (error) {
    console.error("Error in pipeline processing:", error);
    throw error;
  }
}

// Main execution
async function main() {
  console.log("Starting wallet generation process...");

  // Use pipeline approach: read and process in batches
  const results = await processCustomerIdsInBatches();

  // Export results to output file
  await exportToXlsx(results);

  console.log("Process completed successfully!");
}

// Run the main function
main();
