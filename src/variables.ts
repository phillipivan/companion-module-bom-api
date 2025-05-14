import type { BomAPI } from './main.js'
import { CompanionVariableDefinition } from '@companion-module/base'

export function UpdateVariableDefinitions(self: BomAPI): void {
	const variableDefs: CompanionVariableDefinition[] = []
	variableDefs.push({ variableId: `mostRecentData`, name: `Most Recent Data` })
	for (const [key, _value] of Object.entries(self.locationInformation)) {
		variableDefs.push({ variableId: `locInfo_${key}`, name: `Location Info: ${key}` })
	}
	for (const [key, value] of Object.entries(self.observation)) {
		if (typeof value == 'object' && value !== null) {
			for (const [key2, _value2] of Object.entries(value)) {
				variableDefs.push({ variableId: `obs_${key}_${key2}`, name: `Observation: ${key} - ${key2}` })
			}
		} else {
			variableDefs.push({ variableId: `obs_${key}`, name: `Observation: ${key}` })
		}
	}
	for (const [i, warning] of self.warnings.entries()) {
		for (const [key, _value] of Object.entries(warning)) {
			variableDefs.push({ variableId: `warn_${i}_${key}`, name: `Warning [${i}]: ${key}` })
		}
	}
	for (const [i, forecast] of self.forecastDaily.entries()) {
		for (const [key, value] of Object.entries(forecast)) {
			if (typeof value == 'object' && value !== null) {
				for (const [key2, value2] of Object.entries(value)) {
					if (typeof value2 == 'object' && value2 !== null) {
						for (const [key3, _value3] of Object.entries(value2)) {
							variableDefs.push({
								variableId: `fc_day_${i}_${key}_${key2}_${key3}`,
								name: `Daily Forecast [${i}]: ${key} - ${key2} - ${key3}`,
							})
						}
					} else {
						variableDefs.push({
							variableId: `fc_day_${i}_${key}_${key2}`,
							name: `Daily Forecast [${i}]: ${key} - ${key2}`,
						})
					}
				}
			} else {
				variableDefs.push({ variableId: `fc_day_${i}_${key}`, name: `Daily Forecast [${i}]: ${key}` })
			}
		}
	}
	for (const [i, forecast] of self.forecastHourly.entries()) {
		for (const [key, value] of Object.entries(forecast)) {
			if (typeof value == 'object' && value !== null) {
				for (const [key2, value2] of Object.entries(value)) {
					if (typeof value2 == 'object' && value2 !== null) {
						for (const [key3, _value3] of Object.entries(value2)) {
							variableDefs.push({
								variableId: `fc_hour_${i}_${key}_${key2}_${key3}`,
								name: `Hourly Forecast [${i}]: ${key} - ${key2} - ${key3}`,
							})
						}
					} else {
						variableDefs.push({
							variableId: `fc_hour_${i}_${key}_${key2}`,
							name: `Hourly Forecast [${i}]: ${key} - ${key2}`,
						})
					}
				}
			} else {
				variableDefs.push({ variableId: `fc_hour_${i}_${key}`, name: `Hourly Forecast [${i}]: ${key}` })
			}
		}
	}
	variableDefs.push({
		variableId: `fc_hour_issued_at`,
		name: `Hourly Forecast Issued At`,
	})
	variableDefs.push({
		variableId: `fc_day_issued_at`,
		name: `Daliy Forecast Issued At`,
	})
	self.setVariableDefinitions(variableDefs)
}
