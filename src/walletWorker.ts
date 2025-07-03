import { parentPort, workerData } from "worker_threads";
import { CustomerWalletService } from "./CustomerWalletService";

if (!parentPort) throw new Error("Must be run as a worker");

const { customerIds, seedPhrase } = workerData;
const customerWalletService = new CustomerWalletService(seedPhrase);

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

parentPort.postMessage(results);
