declare module "update-notifier" {
	interface Package {
		name: string;
		version: string;
	}

	interface UpdateInfo {
		latest: string;
		current: string;
		type: string;
		name: string;
	}

	interface NotifierConfig {
		get(key: string): unknown;
		set(key: string, value: unknown): void;
		delete(key: string): void;
	}

	interface UpdateNotifier {
		update?: UpdateInfo;
		config?: NotifierConfig;
		fetchInfo(): Promise<UpdateInfo>;
		notify(options?: object): void;
	}

	interface Options {
		pkg: Package;
		updateCheckInterval?: number;
	}

	export default function updateNotifier(options: Options): UpdateNotifier;
}
