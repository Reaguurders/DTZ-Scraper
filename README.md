# Setup

1. Create a new [Google developer project](https://console.developers.google.com/projectcreate)
2. Create a new [service account](https://console.developers.google.com/apis/credentials/serviceaccountkey)
  1. Select "New service account"
  2. Select "JSON" as key type
3. Save the `client_email` and `private_key` into a `.env` file in the root of the project (mind the quotes around the key)
4. Run `yarn install`
5. Run the script `node index`
