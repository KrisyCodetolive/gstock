import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, Eye, EyeOff, LogIn } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api/client'
import { useLogin, useMe } from '../hooks'
import { loginSchema, type LoginForm } from '../schemas'

// Comptes de démonstration : chargés seulement avec les données simulées,
// pour que le build de production ne contienne aucune donnée de démonstration.
const DemoAccounts =
  import.meta.env.VITE_USE_MOCKS === 'true'
    ? lazy(() => import('../components/DemoAccounts').then((m) => ({ default: m.DemoAccounts })))
    : null

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const me = useMe()
  const login = useLogin()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', password: '' },
  })

  const state = location.state as { from?: string; loggedOut?: boolean } | null
  const from = state?.from ?? '/'
  // Pendant une déconnexion volontaire, la session est encore là un instant : on reste ici.
  if (me.data && !state?.loggedOut) return <Navigate to={from} replace />

  const submit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => navigate(from, { replace: true }),
      onError: (error) => {
        if (!(error instanceof ApiError)) return
        for (const field of ['login', 'password'] as const) {
          const message = error.fieldError(field)
          if (message) form.setError(field, { message })
        }
      },
    }),
  )

  const apiError = login.error instanceof ApiError && !login.error.fieldError('login') ? login.error.message : null
  const { errors } = form.formState

  return (
    <div className="min-h-dvh px-4 py-8 lg:grid lg:place-items-center">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <Logo className="justify-self-center" />

        <form onSubmit={submit} noValidate className="pressable-lg grid gap-5 rounded-lg bg-card p-5">
          <div className="grid gap-1">
            <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] uppercase">{t('auth.title')}</h1>
            <p className="text-muted-foreground">{t('auth.subtitle')}</p>
          </div>

          {apiError && (
            <p role="alert" className="flex gap-2 rounded-sm border-2 border-destructive bg-destructive-bg p-3 text-sm font-semibold text-destructive">
              <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
              {apiError}
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="login">{t('auth.login_label')}</Label>
            <Input
              id="login"
              autoComplete="username"
              inputMode="email"
              placeholder={t('auth.login_placeholder')}
              aria-invalid={errors.login ? true : undefined}
              aria-describedby={errors.login ? 'login-error' : undefined}
              {...form.register('login')}
            />
            {errors.login && (
              <p id="login-error" className="text-sm font-semibold text-destructive">
                {errors.login.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">{t('auth.password_label')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-14"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
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
            {errors.password && (
              <p id="password-error" className="text-sm font-semibold text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" variant="action" size="lg" disabled={login.isPending}>
            <LogIn strokeWidth={2.6} aria-hidden="true" />
            {login.isPending ? t('auth.submitting') : t('auth.submit')}
          </Button>
        </form>

        {DemoAccounts && (
          <Suspense>
            <DemoAccounts
              disabled={login.isPending}
              onPick={(account) => {
                form.reset(account)
                void submit()
              }}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
