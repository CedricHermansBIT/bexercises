// src/services/containerCleanupService.js
const { spawn } = require('child_process');
const { getContainerCommand } = require('./dockerService');

/**
 * Container cleanup service
 * Handles orphaned container cleanup and Podman-specific maintenance
 */
class ContainerCleanupService {
	constructor() {
		this.containerCmd = null;
		this.isPodman = false;
		this.cleanupInterval = null;
		this.trackingPrefix = 'bex-';
	}

	/**
	 * Initialize the cleanup service
	 */
	init() {
		try {
			this.containerCmd = getContainerCommand();
			this.isPodman = this.containerCmd === 'podman';
			console.log(`[ContainerCleanup] Using ${this.containerCmd}, isPodman: ${this.isPodman}`);
		} catch (error) {
			console.warn('[ContainerCleanup] No container runtime available:', error.message);
			return;
		}
	}

	/**
	 * Start periodic cleanup (runs every 5 minutes by default)
	 * @param {number} intervalMs - Cleanup interval in milliseconds (default: 5 minutes)
	 */
	startPeriodicCleanup(intervalMs = 5 * 60 * 1000) {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}

		// Run initial cleanup
		this.cleanupOrphanedContainers().catch(err => {
			console.error('[ContainerCleanup] Initial cleanup failed:', err.message);
		});

		// Schedule periodic cleanup
		this.cleanupInterval = setInterval(() => {
			this.cleanupOrphanedContainers().catch(err => {
				console.error('[ContainerCleanup] Periodic cleanup failed:', err.message);
			});
		}, intervalMs);

		console.log(`[ContainerCleanup] Periodic cleanup started (every ${intervalMs / 1000}s)`);
	}

	/**
	 * Stop periodic cleanup
	 */
	stopPeriodicCleanup() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
			console.log('[ContainerCleanup] Periodic cleanup stopped');
		}
	}

	/**
	 * Clean up orphaned containers (those that were not properly cleaned up)
	 * @returns {Promise<Object>} Cleanup result with counts
	 */
	async cleanupOrphanedContainers() {
		if (!this.containerCmd) {
			this.init();
		}

		if (!this.containerCmd) {
			return { removed: 0, errors: 0, message: 'No container runtime available' };
		}

		const result = { removed: 0, errors: 0, containers: [] };

		try {
			// Find all containers with our prefix (both running and stopped)
			const containers = await this.listBexContainers();

			if (containers.length === 0) {
				return result;
			}

			console.log(`[ContainerCleanup] Found ${containers.length} bex-* containers to clean up`);

			// Remove each container
			for (const container of containers) {
				try {
					await this.removeContainer(container.id, container.name);
					result.removed++;
					result.containers.push(container.name);
				} catch (error) {
					console.error(`[ContainerCleanup] Failed to remove ${container.name}:`, error.message);
					result.errors++;
				}
			}

			// If using Podman, also clean up any dangling resources
			if (this.isPodman) {
				await this.podmanCleanup();
			}

			console.log(`[ContainerCleanup] Cleaned up ${result.removed} containers, ${result.errors} errors`);
		} catch (error) {
			console.error('[ContainerCleanup] Error during cleanup:', error.message);
			result.errors++;
		}

		return result;
	}

	/**
	 * List all bex-* containers (both running and stopped)
	 * @returns {Promise<Array>} Array of {id, name, status}
	 */
	async listBexContainers() {
		return new Promise((resolve, reject) => {
			const args = ['ps', '-a', '--filter', `name=${this.trackingPrefix}`, '--format', '{{.ID}}\t{{.Names}}\t{{.Status}}'];
			const proc = spawn(this.containerCmd, args);

			let stdout = '';
			let stderr = '';

			proc.stdout.on('data', (data) => stdout += data.toString());
			proc.stderr.on('data', (data) => stderr += data.toString());

			proc.on('close', (code) => {
				if (code !== 0 && stderr) {
					reject(new Error(`Failed to list containers: ${stderr}`));
					return;
				}

				const containers = stdout.trim().split('\n')
					.filter(line => line.trim())
					.map(line => {
						const [id, name, ...statusParts] = line.split('\t');
						return { id: id.trim(), name: name.trim(), status: statusParts.join('\t').trim() };
					});

				resolve(containers);
			});

			proc.on('error', reject);
		});
	}

	/**
	 * Force remove a container
	 * @param {string} containerId - Container ID
	 * @param {string} containerName - Container name (for logging)
	 */
	async removeContainer(containerId, containerName = '') {
		return new Promise((resolve, reject) => {
			const args = ['rm', '-f', containerId];
			const proc = spawn(this.containerCmd, args);

			let stderr = '';
			proc.stderr.on('data', (data) => stderr += data.toString());

			proc.on('close', (code) => {
				if (code !== 0 && stderr && !stderr.includes('No such container')) {
					reject(new Error(`Failed to remove container ${containerName || containerId}: ${stderr}`));
					return;
				}
				resolve();
			});

			proc.on('error', reject);
		});
	}

	/**
	 * Podman-specific cleanup tasks
	 * Handles: num_locks issue, system prune, lock renumbering
	 */
	async podmanCleanup() {
		if (!this.isPodman) return;

		console.log('[ContainerCleanup] Running Podman-specific cleanup...');

		try {
			// 1. Clean up any dangling images and build cache
			await this.runPodmanCommand(['system', 'prune', '-f', '--volumes']);

			// 2. Renumber locks to fix the "exceeded num_locks" issue
			// This should be done periodically to prevent lock exhaustion
			await this.podmanRenumberLocks();

		} catch (error) {
			console.warn('[ContainerCleanup] Podman cleanup warning:', error.message);
		}
	}

	/**
	 * Renumber Podman locks to fix "exceeded num_locks" issue
	 * This command reorganizes lock numbers after containers are deleted
	 */
	async podmanRenumberLocks() {
		return new Promise((resolve, reject) => {
			console.log('[ContainerCleanup] Renumbering Podman locks...');

			const proc = spawn('podman', ['system', 'renumber']);
			let stderr = '';

			proc.stderr.on('data', (data) => stderr += data.toString());

			proc.on('close', (code) => {
				if (code !== 0) {
					console.warn(`[ContainerCleanup] podman system renumber exited with code ${code}: ${stderr}`);
					// Don't reject - this is not critical
				} else {
					console.log('[ContainerCleanup] Podman locks renumbered successfully');
				}
				resolve();
			});

			proc.on('error', (err) => {
				console.warn('[ContainerCleanup] podman system renumber failed:', err.message);
				resolve(); // Don't reject - this is not critical
			});
		});
	}

	/**
	 * Run a podman command and return the result
	 * @param {Array} args - Command arguments
	 * @returns {Promise<string>} Command output
	 */
	async runPodmanCommand(args) {
		return new Promise((resolve, reject) => {
			const proc = spawn('podman', args);
			let stdout = '';
			let stderr = '';

			proc.stdout.on('data', (data) => stdout += data.toString());
			proc.stderr.on('data', (data) => stderr += data.toString());

			proc.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`podman ${args.join(' ')} failed: ${stderr}`));
					return;
				}
				resolve(stdout);
			});

			proc.on('error', reject);
		});
	}

	/**
	 * Force cleanup all bex containers (useful for emergency cleanup)
	 * @returns {Promise<Object>} Result
	 */
	async forceCleanupAll() {
		console.log('[ContainerCleanup] FORCE: Cleaning up ALL bex-* containers...');

		// First try normal cleanup
		const result = await this.cleanupOrphanedContainers();

		// If using Podman, do aggressive cleanup
		if (this.isPodman) {
			try {
				// Kill any remaining containers
				await this.runPodmanCommand(['kill', '--all']).catch(() => {});

				// Remove all stopped containers
				await this.runPodmanCommand(['container', 'prune', '-f']).catch(() => {});

				// Renumber locks
				await this.podmanRenumberLocks();

				// Full system prune
				await this.runPodmanCommand(['system', 'prune', '-f', '--volumes']).catch(() => {});

				console.log('[ContainerCleanup] FORCE: Podman aggressive cleanup complete');
			} catch (error) {
				console.warn('[ContainerCleanup] FORCE: Some Podman cleanup tasks failed:', error.message);
			}
		}

		return result;
	}

	/**
	 * Get container runtime status and statistics
	 * @returns {Promise<Object>} Status info
	 */
	async getStatus() {
		if (!this.containerCmd) {
			this.init();
		}

		const status = {
			runtime: this.containerCmd || 'none',
			isPodman: this.isPodman,
			bexContainers: 0,
			runningContainers: 0,
			allContainers: 0
		};

		if (!this.containerCmd) {
			return status;
		}

		try {
			// Count bex containers
			const bexContainers = await this.listBexContainers();
			status.bexContainers = bexContainers.length;

			// Count all containers
			const allContainers = await new Promise((resolve) => {
				const proc = spawn(this.containerCmd, ['ps', '-a', '-q']);
				let stdout = '';
				proc.stdout.on('data', (data) => stdout += data.toString());
				proc.on('close', () => {
					resolve(stdout.trim().split('\n').filter(l => l).length);
				});
				proc.on('error', () => resolve(0));
			});
			status.allContainers = allContainers;

			// Count running containers
			const runningContainers = await new Promise((resolve) => {
				const proc = spawn(this.containerCmd, ['ps', '-q']);
				let stdout = '';
				proc.stdout.on('data', (data) => stdout += data.toString());
				proc.on('close', () => {
					resolve(stdout.trim().split('\n').filter(l => l).length);
				});
				proc.on('error', () => resolve(0));
			});
			status.runningContainers = runningContainers;

		} catch (error) {
			console.error('[ContainerCleanup] Error getting status:', error.message);
		}

		return status;
	}
}

// Singleton instance
const containerCleanupService = new ContainerCleanupService();

module.exports = containerCleanupService;

