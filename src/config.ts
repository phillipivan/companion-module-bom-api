import { type SomeCompanionConfigField } from '@companion-module/base'

export enum searchBy {
	LatLong = 'latLong',
	Name = 'name',
}

export interface ModuleConfig {
	latitude: number
	longitude: number
	location: string
	pollInterval: number
	searchBy: searchBy
	verbose: boolean
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'dropdown',
			id: 'searchBy',
			label: 'Search Geohash by',
			width: 6,
			default: searchBy.LatLong,
			choices: [
				{ id: searchBy.LatLong, label: 'Latitude & Longitude' },
				{ id: searchBy.Name, label: 'Name' },
			],
		},
		{
			type: 'number',
			id: 'latitude',
			label: 'Latitude',
			width: 4,
			min: -45,
			max: -10,
			default: -37.3568,
			step: 0.0001,
			isVisible: (options) => {
				return options.searchBy == 'latLong'
			},
		},
		{
			type: 'number',
			id: 'longitude',
			label: 'Longitude',
			width: 4,
			min: 110,
			max: 160,
			default: 144.5274,
			step: 0.0001,
			isVisible: (options) => {
				return options.searchBy == 'latLong'
			},
		},
		{
			type: 'textinput',
			id: 'location',
			label: 'Location',
			width: 8,
			regex: '/^[0-9a-zA-Z]{3,}$/',
			default: 'Adelaide',
			isVisible: (options) => {
				return options.searchBy == 'name'
			},
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'Poll Interval (m)',
			width: 4,
			min: 1,
			max: 120,
			default: 5,
			range: true,
			step: 1,
		},
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Verbose Logs',
			default: false,
			width: 4,
		},
	]
}
