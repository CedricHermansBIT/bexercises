// src/utils/cache.js

/**
 * Simple in-memory cache with TTL support
 * Used for caching frequently accessed data like languages, achievements, etc.
 */
class Cache {
	constructor() {
		this.store = new Map();
		this.timers = new Map();
	}

	/**
	 * Get a value from the cache
	 * @param {string} key - Cache key
	 * @returns {*} Cached value or undefined
	 */
	get(key) {
		const item = this.store.get(key);
		if (!item) return undefined;

		// Check if expired
		if (item.expiry && Date.now() > item.expiry) {
			this.delete(key);
			return undefined;
		}

		return item.value;
	}

	/**
	 * Set a value in the cache
	 * @param {string} key - Cache key
	 * @param {*} value - Value to cache
	 * @param {number} ttl - Time to live in milliseconds (optional)
	 */
	set(key, value, ttl = null) {
		// Clear existing timer if any
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key));
			this.timers.delete(key);
		}

		const item = {
			value,
			expiry: ttl ? Date.now() + ttl : null
		};

		this.store.set(key, item);

		// Set automatic cleanup timer
		if (ttl) {
			const timer = setTimeout(() => {
				this.delete(key);
			}, ttl);
			this.timers.set(key, timer);
		}
	}

	/**
	 * Delete a value from the cache
	 * @param {string} key - Cache key
	 */
	delete(key) {
		this.store.delete(key);
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key));
			this.timers.delete(key);
		}
	}

	/**
	 * Check if a key exists in the cache
	 * @param {string} key - Cache key
	 * @returns {boolean}
	 */
	has(key) {
		return this.get(key) !== undefined;
	}

	/**
	 * Clear all cached values
	 */
	clear() {
		this.timers.forEach(timer => clearTimeout(timer));
		this.timers.clear();
		this.store.clear();
	}

	/**
	 * Invalidate cache entries matching a pattern
	 * @param {string|RegExp} pattern - Pattern to match keys
	 */
	invalidatePattern(pattern) {
		const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
		for (const key of this.store.keys()) {
			if (regex.test(key)) {
				this.delete(key);
			}
		}
	}

	/**
	 * Get cache statistics
	 * @returns {Object} Cache stats
	 */
	stats() {
		return {
			size: this.store.size,
			keys: Array.from(this.store.keys())
		};
	}
}

/**
 * Decorator function for caching async function results
 * @param {Function} fn - Async function to cache
 * @param {Object} options - Cache options
 * @param {Function} options.keyGenerator - Function to generate cache key from arguments
 * @param {number} options.ttl - TTL in milliseconds
 * @param {Cache} options.cache - Cache instance to use
 * @returns {Function} Wrapped function with caching
 */
function cached(fn, { keyGenerator, ttl, cache }) {
	return async function (...args) {
		const key = keyGenerator(...args);
		const cachedValue = cache.get(key);

		if (cachedValue !== undefined) {
			return cachedValue;
		}

		const result = await fn.apply(this, args);
		cache.set(key, result, ttl);
		return result;
	};
}

// Singleton cache instance for global use
const globalCache = new Cache();

module.exports = {
	Cache,
	cached,
	globalCache
};

