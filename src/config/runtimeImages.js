// Defaults for newly configured languages. Persisted language images are kept as-is
// so updating BITLab cannot silently change grading for existing exercises.
module.exports = Object.freeze({
	bash: process.env.RUNNER_IMAGE || 'bitlab-runner:latest',
	python: 'docker.io/library/python:3.11.16-alpine3.24',
	javascript: 'docker.io/library/node:22.23.2-alpine3.24',
	sql: 'docker.io/library/mariadb:11.8.9',
	mariadb: 'docker.io/library/mariadb:11.8.9',
	mongodb: 'docker.io/library/mongo:8.0.32',
	r: 'docker.io/library/r-base:4.6.1',
	php: 'docker.io/library/php:8.4.25-cli-alpine3.23'
});
