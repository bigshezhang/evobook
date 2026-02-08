#!/bin/bash
# Test shop and inventory API endpoints

set -e

BASE_URL="http://localhost:8000/api/v1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Testing Shop & Inventory APIs ===${NC}\n"

# Get JWT token (requires existing user)
echo -e "${BLUE}Step 1: Get JWT token${NC}"
read -p "Enter your JWT token: " JWT_TOKEN

if [ -z "$JWT_TOKEN" ]; then
    echo -e "${RED}❌ JWT token is required${NC}"
    exit 1
fi

AUTH_HEADER="Authorization: Bearer $JWT_TOKEN"

# Test 1: Get shop items
echo -e "\n${BLUE}Test 1: GET /shop/items${NC}"
curl -X GET "$BASE_URL/shop/items" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  | jq '.'

# Test 2: Get shop items filtered by clothes
echo -e "\n${BLUE}Test 2: GET /shop/items?item_type=clothes${NC}"
curl -X GET "$BASE_URL/shop/items?item_type=clothes" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  | jq '.'

# Test 3: Get shop items filtered by furniture
echo -e "\n${BLUE}Test 3: GET /shop/items?item_type=furniture${NC}"
curl -X GET "$BASE_URL/shop/items?item_type=furniture" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  | jq '.total'

# Test 4: Get current currency
echo -e "\n${BLUE}Test 4: GET /game/currency${NC}"
CURRENCY_RESPONSE=$(curl -s -X GET "$BASE_URL/game/currency" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json")

echo "$CURRENCY_RESPONSE" | jq '.'
GOLD=$(echo "$CURRENCY_RESPONSE" | jq -r '.gold')
echo -e "${GREEN}Current gold: $GOLD${NC}"

# Test 5: Get first furniture item ID for purchase test
echo -e "\n${BLUE}Test 5: Get first unpurchased furniture item${NC}"
SHOP_ITEMS=$(curl -s -X GET "$BASE_URL/shop/items?item_type=furniture" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json")

ITEM_ID=$(echo "$SHOP_ITEMS" | jq -r '.items[] | select(.owned == false) | .id' | head -n 1)
ITEM_NAME=$(echo "$SHOP_ITEMS" | jq -r ".items[] | select(.id == \"$ITEM_ID\") | .name")
ITEM_PRICE=$(echo "$SHOP_ITEMS" | jq -r ".items[] | select(.id == \"$ITEM_ID\") | .price")

if [ -z "$ITEM_ID" ] || [ "$ITEM_ID" == "null" ]; then
    echo -e "${RED}❌ No unpurchased items found. All items already owned!${NC}"
    echo "Skipping purchase test..."
else
    echo -e "${GREEN}Found item: $ITEM_NAME (ID: $ITEM_ID, Price: $ITEM_PRICE gold)${NC}"

    # Check if user has enough gold
    if [ "$GOLD" -lt "$ITEM_PRICE" ]; then
        echo -e "${RED}❌ Insufficient gold. Required: $ITEM_PRICE, Available: $GOLD${NC}"
        echo "Skipping purchase test..."
    else
        # Test 6: Purchase item
        echo -e "\n${BLUE}Test 6: POST /shop/purchase${NC}"
        curl -X POST "$BASE_URL/shop/purchase" \
          -H "$AUTH_HEADER" \
          -H "Content-Type: application/json" \
          -d "{\"item_id\": \"$ITEM_ID\"}" \
          | jq '.'

        # Test 7: Verify purchase in inventory
        echo -e "\n${BLUE}Test 7: GET /inventory (verify purchase)${NC}"
        curl -X GET "$BASE_URL/inventory" \
          -H "$AUTH_HEADER" \
          -H "Content-Type: application/json" \
          | jq '.'

        # Test 8: Equip the purchased item
        echo -e "\n${BLUE}Test 8: PUT /inventory/equip (equip item)${NC}"
        curl -X PUT "$BASE_URL/inventory/equip" \
          -H "$AUTH_HEADER" \
          -H "Content-Type: application/json" \
          -d "{\"item_id\": \"$ITEM_ID\", \"equip\": true}" \
          | jq '.'

        # Test 9: Get equipped items only
        echo -e "\n${BLUE}Test 9: GET /inventory?equipped_only=true${NC}"
        curl -X GET "$BASE_URL/inventory?equipped_only=true" \
          -H "$AUTH_HEADER" \
          -H "Content-Type: application/json" \
          | jq '.'

        # Test 10: Unequip the item
        echo -e "\n${BLUE}Test 10: PUT /inventory/equip (unequip item)${NC}"
        curl -X PUT "$BASE_URL/inventory/equip" \
          -H "$AUTH_HEADER" \
          -H "Content-Type: application/json" \
          -d "{\"item_id\": \"$ITEM_ID\", \"equip\": false}" \
          | jq '.'
    fi
fi

# Test 11: Try to purchase already owned item (should fail)
if [ ! -z "$ITEM_ID" ] && [ "$ITEM_ID" != "null" ]; then
    echo -e "\n${BLUE}Test 11: POST /shop/purchase (duplicate purchase - should fail)${NC}"
    curl -X POST "$BASE_URL/shop/purchase" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d "{\"item_id\": \"$ITEM_ID\"}" \
      | jq '.'
fi

# Test 12: Get clothes items
echo -e "\n${BLUE}Test 12: GET /shop/items?item_type=clothes (test clothes exclusivity)${NC}"
CLOTHES_ITEMS=$(curl -s -X GET "$BASE_URL/shop/items?item_type=clothes" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json")

echo "$CLOTHES_ITEMS" | jq '.'

# Try to purchase and equip a clothing item
CLOTHES_ID=$(echo "$CLOTHES_ITEMS" | jq -r '.items[] | select(.owned == false and .name != "No Outfit") | .id' | head -n 1)
CLOTHES_NAME=$(echo "$CLOTHES_ITEMS" | jq -r ".items[] | select(.id == \"$CLOTHES_ID\") | .name")
CLOTHES_PRICE=$(echo "$CLOTHES_ITEMS" | jq -r ".items[] | select(.id == \"$CLOTHES_ID\") | .price")

if [ ! -z "$CLOTHES_ID" ] && [ "$CLOTHES_ID" != "null" ]; then
    # Get updated gold balance
    UPDATED_CURRENCY=$(curl -s -X GET "$BASE_URL/game/currency" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json")
    UPDATED_GOLD=$(echo "$UPDATED_CURRENCY" | jq -r '.gold')

    if [ "$UPDATED_GOLD" -ge "$CLOTHES_PRICE" ]; then
        echo -e "\n${BLUE}Test 13: Purchase and equip clothes item: $CLOTHES_NAME${NC}"

        # Purchase
        curl -s -X POST "$BASE_URL/shop/purchase" \
          -H "$AUTH_HEADER" \
          -H "Content-Type: application/json" \
          -d "{\"item_id\": \"$CLOTHES_ID\"}" \
          | jq '.'

        # Equip
        echo -e "\n${BLUE}Test 14: Equip clothes (should unequip other clothes)${NC}"
        curl -X PUT "$BASE_URL/inventory/equip" \
          -H "$AUTH_HEADER" \
          -H "Content-Type: application/json" \
          -d "{\"item_id\": \"$CLOTHES_ID\", \"equip\": true}" \
          | jq '.'

        # Check profile current_outfit
        echo -e "\n${BLUE}Test 15: GET /profile (verify current_outfit updated)${NC}"
        curl -X GET "$BASE_URL/profile" \
          -H "$AUTH_HEADER" \
          -H "Content-Type: application/json" \
          | jq '.current_outfit'
    fi
fi

echo -e "\n${GREEN}✅ All tests completed!${NC}"
