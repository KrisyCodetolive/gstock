import { authHandlers } from './auth'
import { productsHandlers } from './products'
import { referentialsHandlers } from './referentials'
import { rolesHandlers } from './roles'
import { settingsHandlers } from './settings'
import { shopsHandlers } from './shops'
import { stockHandlers } from './stock'
import { usersHandlers } from './users'

export const handlers = [...authHandlers, ...settingsHandlers, ...shopsHandlers, ...rolesHandlers, ...usersHandlers, ...referentialsHandlers, ...productsHandlers, ...stockHandlers]
