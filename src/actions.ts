import type { BomAPI } from './main.js'
import { DropdownChoice } from '@companion-module/base'

export function UpdateActions(self: BomAPI): void {
	const locations: DropdownChoice[] = []
	self.locations.forEach((location) => {
		locations.push({ id: location.geohash, label: `${location.name} (${location.state}:${location.postcode})` })
	})
	self.setActionDefinitions({
		selectLocation: {
			name: 'Select Location',
			options: [
				{
					id: 'location',
					type: 'dropdown',
					label: 'Location',
					choices: locations,
					default: locations[0].id ?? 'No Locations available',
					allowCustom: false,
				},
			],
			callback: async (action, context) => {
				if (action.options.location == 'No Locations available') return
				const location = self.locations.get(
					await context.parseVariablesInString(action.options.location?.toString() ?? ''),
				)
				if (location) {
					self.location = location
					await self.updateData(location.geohash)
				}
			},
		},
	})
}
