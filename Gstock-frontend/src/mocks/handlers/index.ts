import { authHandlers } from './auth'
import { rolesHandlers } from './roles'
import { settingsHandlers } from './settings'
import { shopsHandlers } from './shops'
import { usersHandlers } from './users'

export const handlers = [...authHandlers, ...settingsHandlers, ...shopsHandlers, ...rolesHandlers, ...usersHandlers]
