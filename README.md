# Rimba NFT Store Backend

## Overview

Rimba NFT Store Backend is a Node.js application that provides APIs for user authentication, NFT asset management, and interaction with the Ethereum blockchain. Users can register, upload NFT assets, set bid prices, mint NFTs, and more. Admins can manage users and NFT assets.

## Features

- User Registration and Authentication
- Upload and Manage NFT Assets
- Generate and Save NFT Metadata
- Mint NFTs on the Ethereum Blockchain
- List All NFT Assets with Minting Status
- Update NFT Asset Details

## Technologies Used

- Node.js
- Express.js
- MongoDB (via Mongoose)
- JWT (JSON Web Token) for Authentication
- Multer for File Uploads
- Web3.js for Blockchain Interaction
- OpenZeppelin Contracts
- Swagger for API Documentation

## Prerequisites

- Node.js (v14.x or higher)
- npm (v6.x or higher)
- MongoDB
- Ganache CLI or GUI (for local Ethereum blockchain)
- Truffle

## Installation

1. **Clone the Repository:**

   ```
   git clone https://github.com/yourusername/rimba-nft-store.git
   cd rimba-nft-store
   ```

2. **Install Dependencies:**

   ```
   npm install
   ```

3. **Setup Environment Variables:**

   Create a `.env` file in the root directory and add the following environment variables:

   ```
   GANACHE_RPC_URL=http://127.0.0.1:8545
   CONTRACT_ADDRESS=0xC543FEe26104D648eDD91eA9a20622239F2dB89f
   PRIVATE_KEY=0xYourPrivateKey  # Replace with your actual private key
   PROJECT_URL=http://localhost:3000
   JWT_SECRET=your_jwt_secret
   ```

4. **Compile and Deploy Smart Contract:**

   ```
   truffle compile
   truffle migrate --network development
   ```

5. **Run the Application:**

   ```
   npm start
   ```

## API Documentation

API documentation is available via Swagger. After running the application, you can access the documentation at:

```
http://localhost:3000/docs
```

## Endpoints

### Authentication

- **Register:** `POST /register`
- **Login:** `POST /login`

### NFT Management

- **Upload NFT Asset:** `POST /api/nfts`
- **Mint NFT:** `POST /api/nfts/mint`
- **List All NFTs:** `GET /api/nfts`
- **Update NFT Asset:** `PUT /api/nfts/:id`

### Usage Examples

#### Register User

```
curl -X POST http://localhost:3000/register \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "testuser",
    "password": "password123",
    "role": "Client"
  }'
```

#### Login User

```
curl -X POST http://localhost:3000/login \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

#### Upload NFT Asset

```
curl -X POST http://localhost:3000/api/nfts \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -F "name=Test NFT" \
  -F "description=This is a test NFT" \
  -F "image=@path/to/image.png" \
  -F "attributes=[{\"trait_type\":\"Background\",\"value\":\"Blue\"}]" \
  -F "bidPrice=100"
```

#### Mint NFT

```
curl -X POST http://localhost:3000/api/nfts/mint \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "toAddress": "0xRecipientAddress",
    "metadataURI": "http://localhost:3000/metadata/metadata-1234567890.json"
  }'
```

#### List All NFTs

```
curl -X GET http://localhost:3000/api/nfts \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Update NFT Asset

```
curl -X PUT http://localhost:3000/api/nfts/ID_OF_NFT \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Updated NFT",
    "description": "This is an updated description",
    "bidPrice": 150,
    "attributes": "[{\"trait_type\":\"Background\",\"value\":\"Red\"}]"
  }'
```

## Project Structure

```
rimba-nft-store/
├── contracts/
│   └── Migrations.sol
│   └── RimbaNFT.sol
├── migrations/
│   └── 1_initial_migrations.js
├── routes/
│   └── authRoutes.js
│   └── userRoutes.js
│   └── nftRoutes.js
├── test/
├── uploads/ (image files will be stored here)
├── metadata/ (metadata JSON files will be stored here)
├── middleware/
│   └── authenticateToken.js
├── eth-nft/
│   └── build/
│   └── contracts/
│       └── RimbaNFT.json
├── truffle-config.js
├── package.json
├── .env
├── server.js
├── swaggerConfig.js
├── ethereum.js
└── README.md
```

## Author
Ahmad Sofyan - asofyan [a] gmail [dot] com Twitter/Telegram: @asofyan

## Contributing

Contributions are welcome! Please submit a pull request or open an issue to discuss any changes or improvements.

## License

This project is licensed under the MIT License.
```