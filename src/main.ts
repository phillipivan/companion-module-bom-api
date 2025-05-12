import {
	InstanceBase,
	runEntrypoint,
	InstanceStatus,
	SomeCompanionConfigField,
	CompanionVariableValues,
} from '@companion-module/base'
import { GetConfigFields, searchBy, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { SearchResponse } from './interfaces.js'
import {
	ForecastItem,
	ForecastRequest,
	Location,
	LocationInformation,
	LocationInformationResponse,
	Oberservation,
	ObservationResponse,
	Warning,
	WarningResponse,
} from './interfaces.js'
import { StatusManager } from './status.js'
import { AxiosInstance, AxiosResponse } from 'axios'
import PQueue from 'p-queue'
import axios from 'axios'

const API_ENDPOINT = `https://api.weather.bom.gov.au/v1/`
const API_TIMEOUT = 5000
const API_HEADERS = { 'Content-Type': 'application/json' }
const API_PATHS = {
	LocationInformation: (geohash: string) => `locations/${geohash}`,
	LocationSearch: () => `locations`,
	ForecastDaily: (geohash: string) => `locations/${geohash.trim().substring(0, 7)}/forecasts/daily`,
	ForecastHourly: (geohash: string) => `locations/${geohash.trim().substring(0, 7)}/forecasts/hourly`,
	Observations: (geohash: string) => `locations/${geohash.trim().substring(0, 6)}/observations`, //geohash must be 6 digit for Observation Station
	Warnings: (geohash: string) => `locations/${geohash.trim().substring(0, 7)}/warnings`,
}

export class BomAPI extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()
	queue = new PQueue({ concurrency: 1 })
	private statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)
	axios: AxiosInstance = axios.create({
		baseURL: API_ENDPOINT,
		timeout: API_TIMEOUT,
		headers: API_HEADERS,
	})
	location: Location = {
		geohash: 'r1qg2z3',
		id: 'Woodend-r1qg2z3',
		name: 'Woodend',
		postcode: null,
		state: 'VIC',
	}
	locationInformation: LocationInformation = {
		geohash: 'r1qg2z3',
		id: 'Woodend-r1qg2z3',
		name: 'Woodend',
		state: 'VIC',
		timezone: '',
		latitude: -37.3568,
		longitude: 144.5274,
	}
	locations: Map<string, Location> = new Map()
	observation!: Oberservation
	forecastDaily: ForecastItem[] = []
	forecastHourly: ForecastItem[] = []
	warnings: Warning[] = []
	recentUpdate: string = ''
	pollTimer!: NodeJS.Timeout

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.configUpdated(config).catch(() => {})
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', `destroy ${this.id}:${this.label}`)
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.statusManager.destroy()
		this.queue.clear()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.config = config
		this.queue.clear()
		await this.searchLocations(config)
		this.updateData().catch(() => {})
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
	}

	public async getForecastHourly(geohash: string = this.location.geohash): Promise<void> {
		try {
			const response = await this.queryApi(API_PATHS.ForecastDaily(geohash))
			const forecasts = ForecastRequest.parse(response?.data)
			this.recentUpdate = forecasts.metadata.response_timestamp
			this.forecastHourly = forecasts.data
		} catch (e: any) {
			this.log('warn', `Hourly Forecast request failed: ${typeof e == 'object' ? JSON.stringify(e) : String(e)}`)
		}
	}

	public async getForecastDaily(geohash: string = this.location.geohash): Promise<void> {
		try {
			const response = await this.queryApi(API_PATHS.ForecastDaily(geohash))
			const forecasts = ForecastRequest.parse(response?.data)
			this.recentUpdate = forecasts.metadata.response_timestamp
			this.forecastDaily = forecasts.data
		} catch (e: any) {
			this.log('warn', `Daily Forecast request failed: ${typeof e == 'object' ? JSON.stringify(e) : String(e)}`)
		}
	}

	public async getWarnings(geohash: string = this.location.geohash): Promise<void> {
		try {
			const response = await this.queryApi(API_PATHS.Warnings(geohash))
			const warnings = WarningResponse.parse(response?.data)
			this.recentUpdate = warnings.metadata.response_timestamp
			this.warnings = warnings.data
		} catch (e: any) {
			this.log('warn', `Warnings request failed: ${typeof e == 'object' ? JSON.stringify(e) : String(e)}`)
		}
	}

	public async getLocationInfo(geohash: string = this.location.geohash): Promise<void> {
		try {
			const response = await this.queryApi(API_PATHS.LocationInformation(geohash))
			const localInfo = LocationInformationResponse.parse(response?.data)
			this.locationInformation = localInfo.data
		} catch (e: any) {
			this.log('warn', `Location Infomation request failed: ${typeof e == 'object' ? JSON.stringify(e) : String(e)}`)
		}
	}

	public async getObservation(geohash: string = this.location.geohash): Promise<void> {
		try {
			const response = await this.queryApi(API_PATHS.Observations(geohash))
			const observation = ObservationResponse.parse(response?.data)
			this.recentUpdate = observation.metadata.response_timestamp
			this.observation = observation.data
		} catch (e: any) {
			this.log('warn', `Observation request failed: ${typeof e == 'object' ? JSON.stringify(e) : String(e)}`)
		}
	}

	private locationSearchParams(config: ModuleConfig): string {
		if (config.searchBy == searchBy.Name) return config.location.trim()
		return config.latitude.toString() + ',' + config.longitude.toString()
	}

	public async searchLocations(config: ModuleConfig = this.config): Promise<void> {
		const response = await this.queryApi(API_PATHS.LocationSearch(), this.locationSearchParams(config))
		if (response) {
			try {
				const results = SearchResponse.parse(response.data)
				this.locations.clear()
				results.data.forEach((location) => {
					this.locations.set(location.geohash, location)
					this.location = location
				})
			} catch (e: any) {
				this.log('warn', `Unexpected response to Location Search ${JSON.stringify(e)}`)
				return
			}
		}
	}

	public async updateData(geohash: string = this.location.geohash): Promise<void> {
		await this.getForecastDaily(geohash)
		await this.getForecastHourly(geohash)
		await this.getObservation(geohash)
		await this.getWarnings(geohash)
		await this.getLocationInfo(geohash)
		this.updateVariableDefinitions() // export variable definitions
		this.updateVariableValues()
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.pollTimer = setTimeout(() => {
			this.updateData(geohash).catch(() => {})
		}, this.config.pollInterval * 60000)
	}

	/**
	 * Make a query of the BOM API
	 * @param path API path to query
	 * @param searchParams To include in query, only required for location search
	 * @returns Axios response or Void if error
	 */
	private async queryApi(path: string, searchParams?: string): Promise<AxiosResponse<any, any> | void> {
		return await this.queue.add(async () => {
			return await this.axios
				.get(path, searchParams ? { params: { search: searchParams } } : {})
				.then((response) => {
					this.statusManager.updateStatus(InstanceStatus.Ok)
					if (this.config.verbose) {
						this.log('debug', `Response from API call to ${path}:\n${JSON.stringify(response.data)}`)
					}
					return response
				})
				.catch((error) => {
					this.log('error', error.cause)
					this.statusManager.updateStatus(InstanceStatus.ConnectionFailure, error.code)
					if (this.config.verbose) this.log('error', JSON.stringify(error))
					return
				})
		})
	}

	updateVariableValues(): void {
		const values: CompanionVariableValues = {}
		values['mostRecentData'] = this.recentUpdate
		for (const [key, value] of Object.entries(this.locationInformation)) {
			values[`locInfo_${key}`] = value ?? undefined
		}
		for (const [key, value] of Object.entries(this.observation)) {
			if (typeof value == 'object' && value !== null) {
				for (const [key2, value2] of Object.entries(value)) {
					values[`obs_${key}_${key2}`] = value2 ?? undefined
				}
			} else {
				values[`obs_${key}`] = value ?? undefined
			}
		}
		for (const [i, warning] of this.warnings.entries()) {
			for (const [key, value] of Object.entries(warning)) {
				values[`warn_${i}_${key}`] = value
			}
		}
		for (const [i, forecast] of this.forecastDaily.entries()) {
			for (const [key, value] of Object.entries(forecast)) {
				if (typeof value == 'object' && value !== null) {
					for (const [key2, value2] of Object.entries(value)) {
						if (typeof value2 == 'object' && value2 !== null) {
							for (const [key3, value3] of Object.entries(value2)) {
								if (typeof value3 == 'number' || typeof value3 == 'string') {
									values[`fc_day_${i}_${key}_${key2}_${key3}`] = value3
								} else {
									values[`fc_day_${i}_${key}_${key2}_${key3}`] = undefined
								}
							}
						} else {
							values[`fc_day_${i}_${key}_${key2}`] = value2 ?? undefined
						}
					}
				} else {
					values[`fc_day_${i}_${key}`] = value ?? undefined
				}
			}
		}
		for (const [i, forecast] of this.forecastHourly.entries()) {
			for (const [key, value] of Object.entries(forecast)) {
				if (typeof value == 'object' && value !== null) {
					for (const [key2, value2] of Object.entries(value)) {
						if (typeof value2 == 'object' && value2 !== null) {
							for (const [key3, value3] of Object.entries(value2)) {
								if (typeof value3 == 'number' || typeof value3 == 'string') {
									values[`fc_hour_${i}_${key}_${key2}_${key3}`] = value3
								} else {
									values[`fc_hour_${i}_${key}_${key2}_${key3}`] = undefined
								}
							}
						} else {
							values[`fc_hour_${i}_${key}_${key2}`] = value2 ?? undefined
						}
					}
				} else {
					values[`fc_hour_${i}_${key}`] = value ?? undefined
				}
			}
		}
		this.setVariableValues(values)
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(BomAPI, UpgradeScripts)
