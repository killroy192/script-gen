import { CustomerWalletService } from "./src/CustomerWalletService";
import * as ExcelJS from "exceljs";
import "dotenv/config";

// Get seed phrase from environment variable
const seed_phrase = process.env.CUSTOMERS_HDNODE_WALLET_PHRASE;

if (!seed_phrase) {
  throw new Error(
    "CUSTOMERS_HDNODE_WALLET_PHRASE environment variable is not set in .env file"
  );
}

const customerWalletService = new CustomerWalletService(seed_phrase);

const customerToWalletMap: { [key: string]: string } = {};

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
    // Assuming the column name is 'Customer ID' or 'customerId' or similar
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

    // Read customer IDs from the column
    worksheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
      if (rowNumber > 1) {
        // Skip header row
        const cell = row.getCell(customerIdColumnIndex);
        const customerId = cell.value?.toString();

        if (customerId && customerId.trim()) {
          customerIds.push(customerId.trim());
        }
      }
    });

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

// Generate wallet addresses for all customer IDs
function generateWallets(customerIds: string[]): any[] {
  const results = [];

  for (let i = 0; i < customerIds.length; i++) {
    const customerId = customerIds[i];
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
      console.error(
        `Error generating wallet for customer ID ${customerId}:`,
        error
      );
      results.push({
        "Customer ID": customerId,
        "Wallet Address": "ERROR",
        Error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

// Export results to output.xlsx
async function exportToXlsx(data: any[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Customer Wallets");

  // Add headers
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
  }

  // Add data rows
  data.forEach((row) => {
    const rowData = Object.values(row);
    worksheet.addRow(rowData);
  });

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
  const results = generateWallets(customerIds);

  // Export results to output file
  await exportToXlsx(results);

  console.log("Process completed successfully!");
}

// Run the main function
main();
