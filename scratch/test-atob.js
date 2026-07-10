const key = "BLhuSkkPPitS3Pi5iwT5wLpudO2k0z8pKjFQxyzQXyhdUxsWseW3GRjnZpKX5MCH5OantV4kCIW1M_69VcZrkx4";
const padding = "=".repeat((4 - (key.length % 4)) % 4);
const base64 = (key + padding).replace(/-/g, "+").replace(/_/g, "/");
console.log("Base64 string:", base64);
console.log("Length:", base64.length);
try {
  const rawData = atob(base64);
  console.log("Success! Raw data length:", rawData.length);
} catch (e) {
  console.error("Error:", e.message);
}
