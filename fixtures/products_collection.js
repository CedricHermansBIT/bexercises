// Sample MongoDB fixture for exercises
// This creates a products collection with sample data

db.products.insertMany([
    {
        name: "Laptop",
        price: 999.99,
        category: "Electronics",
        stock: 50
    },
    {
        name: "Mouse",
        price: 29.99,
        category: "Electronics",
        stock: 200
    },
    {
        name: "Desk",
        price: 299.99,
        category: "Furniture",
        stock: 15
    }
]);
