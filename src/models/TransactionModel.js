/**
 * Transaction related models and types
 */

/**
 * Transaction model
 * @typedef {Object} Transaction
 * @property {string} id - Unique identifier
 * @property {string} driverId - ID of the driver
 * @property {'trip_fee'|'top_up'} type - Type of transaction
 * @property {number} amount - Transaction amount in pesos
 * @property {'pending'|'completed'|'cancelled'|'expired'} status - Status of the transaction
 * @property {string|null} bookingId - ID of the related booking (for trip_fee type)
 * @property {string|null} referenceNumber - Reference number (for top_up type)
 * @property {string|null} description - Additional transaction details
 * @property {Date} createdAt - When the transaction was created
 * @property {Date} updatedAt - When the transaction was last updated
 */

/**
 * Transaction history parameters
 * @typedef {Object} TransactionHistoryParams
 * @property {string} driverId - ID of the driver
 * @property {'trip_fee'|'top_up'|'all'} [type='all'] - Type of transactions to fetch
 * @property {number} [limit=20] - Maximum number of transactions to fetch
 * @property {Date} [startDate] - Start date for filtering transactions
 * @property {Date} [endDate] - End date for filtering transactions
 */