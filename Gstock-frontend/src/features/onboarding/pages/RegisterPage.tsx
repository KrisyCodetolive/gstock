import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Eye, EyeOff, Loader2, Rocket } from 'lucide-react'
import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FieldError, FormAlert, FormField } from '@/components/FormField'
import { Logo } from '@/components/Logo'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { applyApiErrors } from '@/lib/form-errors'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { cn } from '@/lib/utils'
import { PlanOption } from '../components/PlanCard'
import { usePlans, useRegister, useSlugCheck } from '../hooks'
import { REGISTER_STEPS, registerSchema, slugify, type RegisterForm } from '../schemas'

const ALL_FIELDS = REGISTER_STEPS.flatMap((s) => s.fields)
/** Domaine de la plateforme, affiché après l'adresse choisie (ADR-009). */
const DOMAIN = import.meta.env.VITE_PLATFORM_DOMAIN ?? 'gstock.app'

/** Inscription d'un commerçant (M00), sur le domaine principal : trois étapes courtes. */
export function RegisterPage() {
  const { t } = useTranslation()
  const plans = usePlans()
  const registerMutation = useRegister()
  const [step, setStep] = useState(0)
  const [slugEdited, setSlugEdited] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { tenant_name: '', slug: '', shop_name: '', shop_city: 'Abidjan', firstname: '', lastname: '', phone: '', email: '', password: '' },
  })
  const { errors } = form.formState

  // Les étapes se valident sans soumettre le formulaire : un champ en erreur est revérifié dès qu'on le corrige.
  const { subscribe, getFieldState, trigger } = form
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ name }) => {
          const field = name as keyof RegisterForm | undefined
          if (field && getFieldState(field).error) void trigger(field)
        },
      }),
    [subscribe, getFieldState, trigger],
  )
  const slug = useWatch({ control: form.control, name: 'slug' })
  const planId = useWatch({ control: form.control, name: 'plan_id' })
  const debouncedSlug = useDebouncedValue(slug, 400)
  const slugCheck = useSlugCheck(debouncedSlug)
  const trialDays = plans.data?.[0]?.trial_days ?? 14
  const current = REGISTER_STEPS[step]!

  const next = async () => {
    if (!(await form.trigger(current.fields))) return
    // L'adresse doit être libre avant de passer à l'étape suivante.
    if (step === 0 && slugCheck.data && slugCheck.data.available === false && debouncedSlug === slug) {
      form.setError('slug', { message: slugCheck.data.message ?? '' })
      return
    }
    setStep((s) => s + 1)
  }

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    registerMutation.mutate(values, {
      // Le lien ouvre le nouvel espace, sur son adresse, avec une session déjà ouverte.
      onSuccess: (result) => window.location.assign(result.login_url),
      onError: (error) => {
        setFormError(applyApiErrors(error, form.setError, ALL_FIELDS))
        // Revenir à la première étape qui contient une erreur.
        const first = REGISTER_STEPS.findIndex((s) => s.fields.some((f) => form.getFieldState(f).error))
        if (first >= 0) setStep(first)
      },
    })
  })

  return (
    <div className="min-h-dvh px-4 py-8 lg:grid lg:place-items-center">
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <Logo className="justify-self-center" />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (step < REGISTER_STEPS.length - 1) void next()
            else void submit()
          }}
          noValidate
          className="pressable-lg grid gap-5 rounded-lg bg-card p-5"
        >
          <div className="grid gap-1">
            <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] uppercase">{t('register.title')}</h1>
            <p className="text-muted-foreground">{t('register.subtitle', { days: trialDays })}</p>
          </div>

          <ol className="grid grid-cols-3 gap-2" aria-label={t('register.step', { current: step + 1, total: REGISTER_STEPS.length })}>
            {REGISTER_STEPS.map((s, i) => (
              <li key={s.id} aria-current={i === step ? 'step' : undefined} className="grid gap-1.5">
                <span className={cn('h-2 rounded-full border-2 border-foreground', i <= step ? 'bg-primary' : 'bg-muted')} />
                <span className={cn('text-xs font-bold sm:text-sm', i === step ? 'text-foreground' : 'text-muted-foreground')}>
                  {i < step && <Check className="mr-1 inline size-3.5" strokeWidth={3} aria-hidden="true" />}
                  {t(`register.steps.${s.id}`)}
                </span>
              </li>
            ))}
          </ol>

          {formError && <FormAlert>{formError}</FormAlert>}

          {step === 0 && (
            <div className="grid gap-4">
              <FormField id="tenant_name" label={t('register.tenant_name')} error={errors.tenant_name?.message}>
                <Input
                  autoComplete="organization"
                  placeholder={t('register.tenant_name_placeholder')}
                  {...form.register('tenant_name', {
                    // L'adresse suit le nom tant que la personne ne l'a pas changée elle-même.
                    onChange: (e: ChangeEvent<HTMLInputElement>) => {
                      if (!slugEdited) form.setValue('slug', slugify(e.target.value))
                    },
                  })}
                />
              </FormField>

              <div className="grid gap-2">
                <Label htmlFor="slug">{t('register.slug')}</Label>
                <div className="flex items-stretch overflow-hidden rounded-md border-2 border-foreground bg-card focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-primary">
                  <input
                    id="slug"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={errors.slug ? true : undefined}
                    aria-describedby={errors.slug ? 'slug-error' : 'slug-hint'}
                    className="tabular min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
                    {...form.register('slug', {
                      setValueAs: (v: string) => v.trim().toLowerCase(),
                      onChange: () => setSlugEdited(true),
                    })}
                  />
                  <span className="grid place-items-center border-l-2 border-foreground bg-muted px-3 text-sm font-semibold text-muted-foreground">.{DOMAIN}</span>
                </div>
                {errors.slug ? (
                  <FieldError id="slug-error">{errors.slug.message}</FieldError>
                ) : (
                  <p id="slug-hint" className="text-sm text-muted-foreground">
                    {t('register.slug_hint')}
                  </p>
                )}
                <SlugStatus
                  slug={slug}
                  checking={slugCheck.isFetching || debouncedSlug !== slug}
                  result={slug.length >= 3 && debouncedSlug === slug ? slugCheck.data : undefined}
                  hasError={Boolean(errors.slug)}
                  onUse={(s) => {
                    form.setValue('slug', s, { shouldValidate: true })
                    setSlugEdited(true)
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                <FormField id="shop_name" label={t('register.shop_name')} hint={t('register.shop_name_hint')} error={errors.shop_name?.message}>
                  <Input placeholder={t('register.shop_name_placeholder')} {...form.register('shop_name')} />
                </FormField>
                <FormField id="shop_city" label={t('register.shop_city')} error={errors.shop_city?.message}>
                  <Input autoComplete="address-level2" {...form.register('shop_city')} />
                </FormField>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="firstname" label={t('register.firstname')} error={errors.firstname?.message}>
                  <Input autoComplete="given-name" {...form.register('firstname')} />
                </FormField>
                <FormField id="lastname" label={t('register.lastname')} error={errors.lastname?.message}>
                  <Input autoComplete="family-name" {...form.register('lastname')} />
                </FormField>
              </div>
              <FormField id="phone" label={t('register.phone')} error={errors.phone?.message}>
                <Input type="tel" inputMode="tel" autoComplete="tel" placeholder={t('register.phone_placeholder')} {...form.register('phone')} />
              </FormField>
              <FormField id="email" label={t('register.email')} error={errors.email?.message}>
                <Input type="email" inputMode="email" autoComplete="email" {...form.register('email')} />
              </FormField>
              <div className="grid gap-2">
                <Label htmlFor="password">{t('register.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-14"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? 'password-error' : 'password-hint'}
                    {...form.register('password')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1 right-1"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </div>
                {errors.password ? (
                  <FieldError id="password-error">{errors.password.message}</FieldError>
                ) : (
                  <p id="password-hint" className="text-sm text-muted-foreground">
                    {t('register.password_hint')}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">{t('register.plan_hint')}</p>
              {plans.isPending ? (
                <LoadingState rows={3} />
              ) : plans.isError ? (
                <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
              ) : (
                <div role="radiogroup" aria-label={t('register.steps.plan')} className="grid gap-3">
                  {plans.data.map((plan) => (
                    <PlanOption
                      key={plan.id}
                      plan={plan}
                      selected={planId === plan.id}
                      onSelect={() => form.setValue('plan_id', plan.id, { shouldValidate: true })}
                    />
                  ))}
                </div>
              )}
              {errors.plan_id && <p className="text-sm font-semibold text-destructive">{errors.plan_id.message}</p>}
              <p className="text-xs text-muted-foreground">{t('register.terms')}</p>
            </div>
          )}

          <div className="grid grid-cols-[auto_1fr] gap-3">
            {step > 0 ? (
              <Button type="button" variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} disabled={registerMutation.isPending}>
                <ArrowLeft aria-hidden="true" />
                {t('register.back')}
              </Button>
            ) : (
              <span />
            )}
            {step < REGISTER_STEPS.length - 1 ? (
              <Button type="submit" size="lg">
                {t('register.next')}
                <ArrowRight aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" variant="action" size="lg" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Rocket strokeWidth={2.6} aria-hidden="true" />}
                {registerMutation.isPending ? t('register.submitting') : t('register.submit')}
              </Button>
            )}
          </div>
        </form>

        <p className="text-center">
          {t('register.have_account')}{' '}
          <Link to="/connexion" className="font-bold text-primary underline underline-offset-4">
            {t('register.login')}
          </Link>
        </p>
      </div>
    </div>
  )
}

function SlugStatus({
  slug,
  checking,
  result,
  hasError,
  onUse,
}: {
  slug: string
  checking: boolean
  result?: { available: boolean; message: string | null; suggestion: string | null }
  hasError: boolean
  onUse: (slug: string) => void
}) {
  const { t } = useTranslation()
  if (hasError || slug.length < 3) return null
  if (checking && !result) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t('register.slug_checking')}
      </p>
    )
  }
  if (!result) return null
  if (result.available) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-paid-ink" role="status">
        <Check className="size-4" strokeWidth={3} aria-hidden="true" />
        {t('register.slug_available')}
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <CircleAlert className="size-4" aria-hidden="true" />
        {result.message}
      </p>
      {result.suggestion && (
        <Button type="button" variant="outline" size="sm" onClick={() => onUse(result.suggestion!)}>
          {t('register.slug_use', { slug: result.suggestion })}
        </Button>
      )}
    </div>
  )
}
