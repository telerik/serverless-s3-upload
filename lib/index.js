"us strict";

const S3Service = require("./services/s3-service");

class CustomDomainPlugin {
	constructor(serverless, options) {
		this.serverless = serverless;
		this.options = options;

		// TODO: Add command.
		this.hooks = {
			"after:deploy:deploy": this.uploadToS3.bind(this)
		};
	}

	async uploadToS3() {
		const s3Service = new S3Service(this.serverless, this.options);
		await s3Service.uploadAsync();
	}
}

module.exports = CustomDomainPlugin;
