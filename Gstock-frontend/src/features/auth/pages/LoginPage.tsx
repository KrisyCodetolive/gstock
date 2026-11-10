import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, CircleAlert, Eye, EyeOff, LogIn, Store } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api/client'
import { isCentralHost } from '@/lib/tenant-host'
import type { CentralSpace } from '@/types/auth'
import { useCentralLogin, useLogin, useMe } from '../hooks'
import { loginSchema, type LoginForm } from '../schemas'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const me = useMe()
  const tenantLogin = useLogin()
  const centralLogin = useCentralLogin()
  // Domaine principal (ADR-009) : on cherche l'espace du compte, puis on l'y envoie déjà connecté.
  const central = isCentralHost()
  const login = central ? centralLogin : tenantLogin
  const [spaces, setSpaces] = useState<CentralSpace[] | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', password: '' },
  })

  const state = location.state as { from?: string; loggedOut?: boolean } | null
  const from = state?.from ?? '/'
  // Pendant une déconnexion volontaire, la session est encore là un instant : on reste ici.
  if (me.data && !state?.loggedOut) return <Navigate to={from} replace />

  const onError = (error: Error) => {
    if (!(error instanceof ApiError)) return
    for (const field of ['login', 'password'] as const) {
      const message = error.fieldError(field)
      if (message) form.setError(field, { message })
    }
  }
  const submit = form.handleSubmit((values) =>
    central
      ? centralLogin.mutate(values, {
          // Un seul espace : on y va directement ; plusieurs : la personne choisit.
          onSuccess: (found) => (found.length === 1 ? window.location.assign(found[0]!.login_url) : setSpaces(found)),
          onError,
        })
      : tenantLogin.mutate(values, { onSuccess: () => navigate(from, { replace: true }), onError }),
  )

  const apiError = login.error instanceof ApiError && !login.error.fieldError('login') ? login.error.message : null
  const { errors } = form.formState

  return (
    <div className="min-h-dvh px-4 py-8 lg:grid lg:place-items-center">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <Logo className="justify-self-center" />

        {spaces ? (
          <section className="pressable-lg grid gap-4 rounded-lg bg-card p-5">
            <div className="grid gap-1">
              <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] uppercase">{t('auth.spaces_title')}</h1>
              <p className="text-muted-foreground">{t('auth.spaces_subtitle')}</p>
            </div>
            <ul className="grid gap-3">
              {spaces.map((s) => (
                <li key={s.slug}>
                  <a href={s.login_url} className="pressable flex min-h-14 items-center gap-3 rounded-md bg-card px-4 font-bold">
                    <Store className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="grid min-w-0 flex-1">
                      {s.name}
                      <span className="truncate text-sm font-normal text-muted-foreground">{s.url.replace(/^https?:\/\//, '')}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" onClick={() => setSpaces(null)}>
              {t('auth.spaces_back')}
            </Button>
          </section>
        ) : (
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
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="password">{t('auth.password_label')}</Label>
                {/* Le mot de passe se réinitialise dans l'espace : pas sur le domaine principal. */}
                {!central && (
                  <Link to="/mot-de-passe-oublie" className="text-sm font-bold text-primary underline-offset-4 hover:underline">
                    {t('auth.forgot_link')}
                  </Link>
                )}
              </div>
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
        )}

        <Link to="/inscription" className="pressable flex min-h-12 items-center justify-center rounded-md bg-tint-yellow px-4 text-center font-bold">
          {t('register.cta_from_login')}
        </Link>
      </div>
    </div>
  )
}
