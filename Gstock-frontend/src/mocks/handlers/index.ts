import { authHandlers } from './auth'
import { creditsHandlers } from './credits'
import { customersHandlers } from './customers'
import { productsHandlers } from './products'
import { referentialsHandlers } from './referentials'
import { rolesHandlers } from './roles'
import { salesHandlers } from './sales'
import { settingsHandlers } from './settings'
import { shopsHandlers } from './shops'
import { stockHandlers } from './stock'
import { usersHandlers } from './users'

export const handlers = [...authHandlers, ...settingsHandlers, ...shopsHandlers, ...rolesHandlers, ...usersHandlers, ...referentialsHandlers, ...productsHandlers, ...stockHandlers, ...customersHandlers, ...salesHandlers, ...creditsHandlers]
