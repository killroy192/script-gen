import { HDNodeWallet } from "ethers";

// CUSTOMERS_HDNODE_WALLET_PHRASE

export class CustomerWalletService {
  constructor(private readonly phrase: string) {}

  static isCosumerIdValid(consumerId: string) {
    return (
      typeof consumerId === "string" &&
      consumerId.length == 64 &&
      !!consumerId.match(/^[0-9A-Fa-f]*$/)
    );
  }

  static getCustomerWalletDerivationPath(consumerId: string) {
    if (!CustomerWalletService.isCosumerIdValid(consumerId)) {
      throw new Error(`consumerId = '${consumerId}' is not valid`);
    }
    function chunk(s: string, length: number) {
      const n = Math.ceil(s.length / length);
      const chunks = new Array<string>(n);

      for (let i = 0, j = 0; i < n; ++i, j += length) {
        chunks[i] = s.substring(j, j + length);
      }

      return chunks;
    }

    return (
      "m" +
      chunk(consumerId, 4)
        .map((x, i) => "/" + parseInt(x, 16) + (i % 2 === 0 ? "'" : ""))
        .join("")
    );
  }

  getCustomerWalletAddress(consumerId: string) {
    return HDNodeWallet.fromPhrase(
      this.phrase,
      undefined,
      CustomerWalletService.getCustomerWalletDerivationPath(consumerId)
    ).address;
  }
}
