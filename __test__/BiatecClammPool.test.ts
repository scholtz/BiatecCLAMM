/**
 * BiatecClammPool Test Suite
 *
 * This test suite has been reorganized into focused modules for better maintainability.
 * All tests are now located in the __test__/pool/ directory.
 *
 * Test Organization:
 * - pool/deployment.test.ts - Pool deployment and validation tests
 * - pool/calculations.test.ts - Calculation method tests
 * - pool/liquidity.test.ts - Liquidity add/remove operation tests
 * - pool/swaps.test.ts - Swap functionality tests
 * - pool/fees.test.ts - Fee management and ASASR tests
 * - pool/extreme.test.ts - Extreme price scenario tests
 * - pool/misc.test.ts - Miscellaneous tests (network, algo/asa, npm)
 * - pool/shared-setup.ts - Common setup, constants, and utilities
 *
 * To run all pool tests:
 *   npm test -- __test__/pool
 *
 * To run a specific test category:
 *   npm test -- __test__/pool/calculations.test.ts
 */

// Import all test modules to ensure they are discovered by Jest
import './pool/deployment.test';
import './pool/calculations.test';
import './pool/liquidity.test';
import './pool/swaps.test';
import './pool/fees.test';
import './pool/extreme.test';
import './pool/misc.test';
