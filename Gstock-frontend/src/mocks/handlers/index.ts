import { authHandlers } from './auth'
import { creditsHandlers } from './credits'
import { customersHandlers } from './customers'
import { dashboardHandlers } from './dashboard'
import { platformHandlers } from './platform'
import { productsHandlers } from './products'
import { purchasesHandlers } from './purchases'
import { referentialsHandlers } from './referentials'
import { rolesHandlers } from './roles'
import { salesHandlers } from './sales'
import { settingsHandlers } from './settings'
import { shopsHandlers } from './shops'
import { stockHandlers } from './stock'
import { syncHandlers } from './sync'
import { usersHandlers } from './users'

// La garde « lecture seule » de platformHandlers doit passer avant tous les autres.
export const handlers = [...platformHandlers, ...authHandlers, ...settingsHandlers, ...shopsHandlers, ...rolesHandlers, ...usersHandlers, ...referentialsHandlers, ...productsHandlers, ...stockHandlers, ...customersHandlers, ...salesHandlers, ...creditsHandlers, ...purchasesHandlers, ...dashboardHandlers, ...syncHandlers]
