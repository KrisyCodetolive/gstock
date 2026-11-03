import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import type { Permission } from '@/types/auth'
import type { PermissionDefinition, PermissionGroup } from '@/types/users'

/**
 * Grille des permissions prédéfinies, groupées par domaine, avec
 * « tout cocher » par groupe (M04). En lecture seule pour Owner.
 */
export function PermissionGrid({
  definitions,
  value,
  onChange,
  readOnly,
}: {
  definitions: PermissionDefinition[]
  value: Permission[]
  onChange: (value: Permission[]) => void
  readOnly?: boolean
}) {
  const { t } = useTranslation()
  const groups = [...new Set(definitions.map((d) => d.group))]

  const toggle = (name: Permission, checked: boolean) =>
    onChange(checked ? [...value, name] : value.filter((p) => p !== name))

  const toggleGroup = (group: PermissionGroup, checked: boolean) => {
    const names = definitions.filter((d) => d.group === group).map((d) => d.name)
    onChange(checked ? [...new Set([...value, ...names])] : value.filter((p) => !names.includes(p)))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => {
        const items = definitions.filter((d) => d.group === group)
        const checkedCount = items.filter((d) => value.includes(d.name)).length
        const all = checkedCount === items.length
        const level = items[0]?.level
        return (
          <fieldset key={group} className="grid content-start gap-3 rounded-lg border-2 border-foreground bg-card p-4">
            <legend className="sr-only">{t(`roles.groups.${group}`)}</legend>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="grid">
                <span className="text-base font-bold" aria-hidden="true">
                  {t(`roles.groups.${group}`)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {level === 'shop' ? t('roles.form.level_shop') : t('roles.form.level_tenant')} · {checkedCount}/{items.length}
                </span>
              </div>
              {!readOnly && (
                <Button type="button" variant="ghost" size="sm" className="-mt-1 -mr-2" onClick={() => toggleGroup(group, !all)}>
                  {all ? t('roles.form.uncheck_all') : t('roles.form.check_all')}
                </Button>
              )}
            </div>
            <ul className="grid gap-1">
              {items.map((d) => {
                const id = `perm-${d.name.replace('.', '-')}`
                return (
                  <li key={d.name}>
                    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-1 hover:bg-muted has-disabled:cursor-default has-disabled:hover:bg-transparent">
                      <Checkbox
                        id={id}
                        checked={value.includes(d.name)}
                        disabled={readOnly}
                        onCheckedChange={(checked) => toggle(d.name, checked === true)}
                      />
                      <span className="text-[15px]">{d.label}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        )
      })}
    </div>
  )
}
