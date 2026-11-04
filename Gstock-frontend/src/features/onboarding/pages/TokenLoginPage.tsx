import { LinkIcon, LogIn } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Logo } from '@/components/Logo'
import { MessageBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import { useTokenLogin } from '../hooks'

/**
 * Lien de connexion à usage unique reçu à l'inscription : il ouvre le nouvel espace
 * sur son adresse, avec la session du propriétaire, puis l'assistant de démarrage.
 */
export function TokenLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('jeton') ?? ''
  const login = useTokenLogin()
  const started = useRef(false)

  useEffect(() => {
    // Une seule tentative : le lien ne sert qu'une fois.
    if (!token || started.current) return
    started.current = true
    login.mutate(token, {
      onSuccess: (me) => {
        // Mode support du back-office : l'accueil de la personne, avec son bandeau ; sinon, fin d'inscription.
        if (me.support) {
          void navigate('/', { replace: true })
          return
        }
        toast.success(t('register.created'))
        void navigate('/demarrage', { replace: true })
      },
    })
  }, [token, login, navigate, t])

  if (!token || login.isError) {
    const message = !token ? t('token_login.missing') : login.error instanceof ApiError ? login.error.message : t('common.generic_error')
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="grid gap-6">
          <Logo className="justify-self-center" />
          <MessageBlock
            icon={LinkIcon}
            tone="danger"
            title={t('token_login.failed_title')}
            text={message}
            action={
              <Button asChild>
                <Link to="/connexion">
                  <LogIn aria-hidden="true" />
                  {t('token_login.to_login')}
                </Link>
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label={t('token_login.title')}>
      <div className="grid justify-items-center gap-4">
        <Logo className="animate-pulse" />
        <p className="font-semibold">{t('token_login.title')}</p>
      </div>
    </div>
  )
}
