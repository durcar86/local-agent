// src/utils/checkWriter.js

function numberToWords(n) {
  const belowTwenty = [
    "", "One", "Two", "Three", "Four", "Five", "Six",
    "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];

  const tens = [
    "", "", "Twenty", "Thirty", "Forty",
    "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  const thousands = ["", "Thousand", "Million", "Billion"];

  if (n === 0) return "Zero";

  function helper(num) {
    if (num < 20) return belowTwenty[num];
    if (num < 100)
      return tens[Math.floor(num / 10)] +
        (num % 10 ? " " + belowTwenty[num % 10] : "");
    if (num < 1000)
      return belowTwenty[Math.floor(num / 100)] +
        " Hundred" +
        (num % 100 ? " " + helper(num % 100) : "");
    return "";
  }

  let word = "";
  let i = 0;

  while (n > 0) {
    if (n % 1000 !== 0) {
      word =
        helper(n % 1000) +
        (thousands[i] ? " " + thousands[i] : "") +
        (word ? " " + word : "");
    }
    n = Math.floor(n / 1000);
    i++;
  }

  return word.trim();
}

function cleanValue(value) {
  // Remove ALL non-numeric characters except decimal point
  // This handles: $, commas, spaces, etc.
  let cleaned = value.toString().replace(/[^\d.]/g, "");
  
  console.log('📝 Clean step:', { input: value, output: cleaned });
  return cleaned;
}

function ensureFormat(value) {
  // Split on decimal point
  let parts = value.split('.');
  
  // Handle integer (no decimal)
  if (parts.length === 1) {
    value = parts[0] + '.00';
  }
  // Handle decimal with 1 digit (e.g., 2630.5 -> 2630.50)
  else if (parts.length === 2 && parts[1].length === 1) {
    value = parts[0] + '.' + parts[1] + '0';
  }
  // Handle decimal with 2 digits (already correct)
  else if (parts.length === 2 && parts[1].length === 2) {
    value = parts[0] + '.' + parts[1];
  }
  // Handle more than 2 decimal places (truncate)
  else if (parts.length === 2 && parts[1].length > 2) {
    value = parts[0] + '.' + parts[1].substring(0, 2);
  }
  // Handle multiple decimal points (take first two parts only)
  else if (parts.length > 2) {
    value = parts[0] + '.' + parts[1].substring(0, 2);
  }
  
  console.log('📝 Format step:', { input: value, output: value });
  return value;
}

function convertToCheckWords(value) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 CheckWriter START');
  console.log('📝 Input value:', value, '(type:', typeof value, ')');
  
  // Step 1: Clean the value (remove $, commas, spaces)
  value = cleanValue(value);
  
  // Step 2: Ensure proper decimal format
  value = ensureFormat(value);
  
  console.log('📝 Final cleaned value:', value);

  // Step 3: Validate format (must be digits.digits now)
  if (!/^\d+\.\d{2}$/.test(value)) {
    console.error('❌ Invalid format after processing:', value);
    throw new Error(`Invalid format: "${value}". Expected format like: 1234.56`);
  }

  // Step 4: Split into dollars and cents
  const [dollarStr, centStr] = value.split(".");
  const dollars = parseInt(dollarStr, 10);
  const cents = parseInt(centStr, 10);

  console.log('📝 Parsed values:', { 
    dollarStr, 
    centStr, 
    dollars, 
    cents,
    dollarStrLength: dollarStr.length
  });

  // Step 5: Convert dollars to words
  const dollarWords = numberToWords(dollars);
  const fractionFormat = `${centStr}/100`;

  const result = {
    numeric: `$${value}`,
    words: `${dollarWords} and ${fractionFormat} Dollars`
  };

  console.log('📝 Result:', result);
  console.log('📝 CheckWriter END');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return result;
}

export { convertToCheckWords };