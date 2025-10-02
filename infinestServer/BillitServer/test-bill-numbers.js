// Simple test to verify the bill number API endpoints
const mongoose = require('mongoose');
const { generateNextBillNumber, checkBillNumberExists } = require('./controllers/api/billNumberController');

// Mock request and response objects for testing
const createMockReq = (body) => ({ body });
const createMockRes = () => {
  let statusCode = 200;
  let responseData = {};
  const res = {
    status: (code) => { 
      statusCode = code; 
      return res; 
    },
    json: (data) => { 
      responseData = data; 
      console.log(`Status: ${statusCode}`, JSON.stringify(data, null, 2)); 
      return res;
    },
    statusCode,
    responseData
  };
  return res;
};

async function testBillNumberAPIs() {
  try {
    console.log('🧪 Testing Bill Number APIs...\n');

    // Test 1: Generate next bill number for CUST prefix
    console.log('Test 1: Generate next CUST bill number');
    const req1 = createMockReq({ 
      prefix: 'CUST', 
      userId: '507f1f77bcf86cd799439011' // Mock MongoDB ObjectId
    });
    const res1 = createMockRes();
    await generateNextBillNumber(req1, res1);

    // Test 2: Generate next bill number for DEAL prefix  
    console.log('\nTest 2: Generate next DEAL bill number');
    const req2 = createMockReq({ 
      prefix: 'DEAL', 
      userId: '507f1f77bcf86cd799439011'
    });
    const res2 = createMockRes();
    await generateNextBillNumber(req2, res2);

    // Test 3: Check if bill number exists
    console.log('\nTest 3: Check if bill number exists');
    const req3 = createMockReq({ 
      billNumber: 'CUST-0001', 
      userId: '507f1f77bcf86cd799439011'
    });
    const res3 = createMockRes();
    await checkBillNumberExists(req3, res3);

    // Test 4: Invalid prefix
    console.log('\nTest 4: Invalid prefix error');
    const req4 = createMockReq({ 
      prefix: 'INVALID', 
      userId: '507f1f77bcf86cd799439011'
    });
    const res4 = createMockRes();
    await generateNextBillNumber(req4, res4);

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    // Don't close mongoose connection as the main server might be using it
    console.log('\n🏁 Test finished');
  }
}

// Run tests
testBillNumberAPIs();