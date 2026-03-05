#!/bin/bash

# Check if host is provided as a command line argument
if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 https://pizza-service.jtbrock.click"
  exit 1
fi

host=$1
curl_opts="--ssl-no-revoke -s"

echo "Authenticating as admin..."

response=$(curl $curl_opts -X PUT $host/api/auth \
  -d '{"email":"a@jwt.com", "password":"admin"}' \
  -H 'Content-Type: application/json')

token=$(echo $response | jq -r '.token')

if [ "$token" == "null" ] || [ -z "$token" ]; then
  echo "Failed to retrieve auth token."
  echo "Response was: $response"
  exit 1
fi

echo "Token retrieved successfully."

# Add users
echo "Adding users..."
curl $curl_opts -X POST $host/api/auth \
  -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' \
  -H 'Content-Type: application/json'

curl $curl_opts -X POST $host/api/auth \
  -d '{"name":"pizza franchisee", "email":"f@jwt.com", "password":"franchisee"}' \
  -H 'Content-Type: application/json'

# Add menu
echo "Adding menu items..."
curl $curl_opts -X PUT $host/api/order/menu \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" \
  -d '{ "title":"Veggie", "description":"A garden of delight", "image":"pizza1.png", "price":0.0038 }'

curl $curl_opts -X PUT $host/api/order/menu \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" \
  -d '{ "title":"Pepperoni", "description":"Spicy treat", "image":"pizza2.png", "price":0.0042 }'

curl $curl_opts -X PUT $host/api/order/menu \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" \
  -d '{ "title":"Margarita", "description":"Essential classic", "image":"pizza3.png", "price":0.0042 }'

curl $curl_opts -X PUT $host/api/order/menu \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" \
  -d '{ "title":"Crusty", "description":"A dry mouthed favorite", "image":"pizza4.png", "price":0.0028 }'

curl $curl_opts -X PUT $host/api/order/menu \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" \
  -d '{ "title":"Charred Leopard", "description":"For those with a darker side", "image":"pizza5.png", "price":0.0099 }'

# Add franchise and store
echo "Adding franchise and store..."
curl $curl_opts -X POST $host/api/franchise \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" \
  -d '{"name":"pizzaPocket","admins":[{"email":"f@jwt.com"}]}'

curl $curl_opts -X POST $host/api/franchise/1/store \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $token" \
  -d '{"franchiseId":1,"name":"SLC"}'

echo "Database data generated successfully."