# Wallet Generation Script

This application reads customer IDs from an Excel file, generates unique wallet addresses for each customer using a BIP39 seed phrase, and exports the results to an output Excel file.

> **⚠️ Security Recommendation:**
> 
> **Always run this script offline.** Never run it on a machine connected to the internet while your seed phrase is present. This reduces the risk of your seed phrase being leaked or compromised.
>
> **Never commit your `.env` file to version control.**

## Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

## Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd wallet-script
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## Setup

### 1. Create Environment File

Create a `.env` file in the project root directory with your BIP39 seed phrase:

```bash
# Create .env file
echo "CUSTOMERS_HDNODE_WALLET_PHRASE=your twelve or twenty four word seed phrase here" > .env
```

**Example .env file:**
```
CUSTOMERS_HDNODE_WALLET_PHRASE=cup addict season rather truth answer estate bracket wool lake coil library
```

note: The seed phrase should be 12, 15, 18, 21, or 24 words long

### 2. Prepare Input File

Create an `input.xlsx` file in the project root with your customer IDs. The file should have a column containing customer IDs.

**Supported column names:**
- `Customer ID`
- `customerId`
- `CustomerID`
- `customer_id`
- `customerID`
- `CustomerId`

**Example input.xlsx structure:**
| Customer ID |
|-------------|
| 712f921042c44e1e27a4500d8158df4a2257bc1ac1b9618971a8a0bb9f9059fa |
| 812f921042c44e1e27a4500d8158df4a2257bc1ac1b9618971a8a0bb9f9059fb |
| 912f921042c44e1e27a4500d8158df4a2257bc1ac1b9618971a8a0bb9f9059fc |

**Customer ID Requirements:**
- Must be exactly 64 characters long
- Must contain only hexadecimal characters (0-9, A-F, a-f)
- Example format: `712f921042c44e1e27a4500d8158df4a2257bc1ac1b9618971a8a0bb9f9059fa`

## Usage

### Run the Application

```bash
npm run generate
```

### What Happens

1. **Environment Check**: The script verifies that the seed phrase is set in the `.env` file
2. **Input Reading**: Reads customer IDs from `input.xlsx`
3. **Wallet Generation**: Generates unique wallet addresses for each customer ID
4. **Output Creation**: Creates `output.xlsx` with the results
5. **Progress Display**: Shows progress and any errors during processing

### Output

The script generates an `output.xlsx` file with the following columns:

| Column | Description |
|--------|-------------|
| Customer ID | The original customer ID from input |
| Wallet Address | The generated Ethereum wallet address |
| Error | Error message (if wallet generation failed) |

**Example output.xlsx:**
| Customer ID | Wallet Address |
|-------------|----------------|
| 712f921042c44e1e27a4500d8158df4a2257bc1ac1b9618971a8a0bb9f9059fa | 0xcc7bD1c576461B48222E9D8B8b9450348a2aE7f7 |
| 812f921042c44e1e27a4500d8158df4a2257bc1ac1b9618971a8a0bb9f9059fb | 0x8a2bC1d576461B48222E9D8B8b9450348a2aE7f8 |

## Error Handling

The application handles various error scenarios:

- **Missing .env file**: Shows clear error message about missing environment variable
- **Invalid customer IDs**: Logs errors for invalid customer IDs but continues processing
- **Duplicate customer IDs**: Skips duplicate entries and shows warning
- **File read errors**: Provides detailed error messages for file access issues

## Troubleshooting

### Common Issues

1. **"CUSTOMERS_HDNODE_WALLET_PHRASE environment variable is not set"**
   - Solution: Create a `.env` file with your seed phrase

2. **"No customer IDs found in input.xlsx"**
   - Solution: Check that your Excel file has the correct column name
   - Verify the file is not empty

3. **"consumerId is not valid"**
   - Solution: Ensure customer IDs are exactly 64 hexadecimal characters

4. **"Error reading input.xlsx"**
   - Solution: Check that `input.xlsx` exists in the project root
   - Verify the file is not corrupted

5. **npm audit shows security vulnerabilities**
   - The `exceljs` library is used for Excel file operations, which is more secure and maintained than `xlsx`
   - For production environments, always run the application offline
   - Only process trusted Excel files

### File Structure

After setup, your project should look like this:

```
wallet-script/
├── .env                          # Your seed phrase (not in git)
├── input.xlsx                    # Customer IDs to process
├── output.xlsx                   # Generated wallet addresses
├── index.ts                      # Main script
├── src/
│   └── CustomerWalletService.ts  # Wallet generation logic
├── package.json
└── README.md
```

## Security Considerations

- **Running Mode**: **Run offline** (disconnect from the internet before running the script)
- **Seed Phrase Security**: Your seed phrase controls all generated wallets. Keep it secure!
- **File Permissions**: Ensure your `.env` file has restricted permissions
- **Backup**: Always backup your seed phrase in a secure location
- **Testing**: Test with small datasets before processing large customer lists

## Technical Details

- **Wallet Derivation**: Uses BIP39/BIP44 standards for deterministic wallet generation
- **Customer ID Processing**: Each customer ID is converted to a unique derivation path
- **Excel Processing**: Uses the `exceljs` library for reading and writing Excel files
- **Error Recovery**: Continues processing even if individual customer IDs fail

## License

This project is licensed under the MIT License. 