import { authHandlers } from './auth'
import { settingsHandlers } from './settings'
import { shopsHandlers } from './shops'

export const handlers = [...authHandlers, ...settingsHandlers, ...shopsHandlers]
