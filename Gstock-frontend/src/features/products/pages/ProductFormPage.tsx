import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, ClipboardCheck, CopyPlus, Eye, EyeOff, History, PackageMinus, PackagePlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormAlert, FormField } from '@/components/FormField'
import { FormActions, FormSection, SwitchField } from '@/components/FormLayout'
import { PageHeader } from '@/components/PageHeader'
import { ScanButton } from '@/components/BarcodeScanner'
import { PhotoPicker } from '@/components/PhotoPicker'
import { SelectField } from '@/components/SelectField'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCan, useSession } from '@/features/auth/hooks'
import { QuickReferentialCreate } from '@/features/referentials/components/QuickReferentialCreate'
import { useReferentialList } from '@/features/referentials/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { MovementsPreview } from '@/features/stock/components/MovementsPreview'
import { ProductSuppliersSection } from '@/features/purchases/components/ProductSuppliersSection'
import { ProductLotsSection } from '@/features/stock/components/ProductLotsSection'
import { StockQuickSheet } from '@/features/stock/components/StockQuickSheet'
import { apiErrorMessage, applyApiErrors } from '@/lib/form-errors'
import { formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/catalog'
import type { AdjustmentKind } from '@/types/stock'
import { ProductThumb } from '../components/ProductThumb'
import { StockStateBadge } from '../components/StockStateBadge'
import { VariantsEditor } from '../components/VariantsEditor'
import { useProduct, useProductImage, useProductStock, useSaveProduct } from '../hooks'
import { emptyVariant, formToPayload, PRODUCT_FIELDS, productSchema, productToForm, type ProductForm } from '../schemas'

/** Création rapide (/produits/nouveau) et fiche produit (/produits/:id). */
export function ProductFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const productId = id ? Number(id) : undefined
  const { shop } = useCurrentShop()
  const product = useProduct(productId, shop?.id)

  return (
    <div className="grid gap-6">
      <BackLink to="/produits" label={t('products.back')} />
      {productId === undefined ? (
        <>
          <PageHeader title={t('products.new_title')} />
          <ProductFormBody />
        </>
      ) : product.isPending ? (
        <LoadingState rows={4} />
      ) : product.isError ? (
        <ErrorState error={product.error} onRetry={() => void product.refetch()} />
      ) : (
        <>
          <header className="flex flex-wrap items-center gap-3">
            <ProductThumb name={product.data.name} color={product.data.category?.color} imageUrl={product.data.image_url} type={product.data.type} className="size-14" />
            <div className="grid min-w-0 flex-1 gap-1">
              <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.02em] uppercase">{product.data.name}</h1>
              <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {product.data.code}
                {product.data.stock && <StockStateBadge state={product.data.stock.state} />}
                {!product.data.is_active && <StatusBadge>{t('products.inactive')}</StatusBadge>}
              </span>
            </div>
          </header>
          <ProductFormBody key={product.data.id} product={product.data} />
        </>
      )}
    </div>
  )
}

function ProductFormBody({ product }: { product?: Product }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const can = useCan()
  const { tenant } = useSession()
  const { shop } = useCurrentShop()
  const save = useSaveProduct(product?.id)
  const image = useProductImage()
  // Création : la photo choisie est envoyée juste après l'enregistrement du produit.
  const [pendingPhoto, setPendingPhoto] = usePendingPhoto()
  const categories = useReferentialList('categories', { per_page: 100, sort: 'name', filter: { is_active: 'true' } })
  const units = useReferentialList('units', { per_page: 100, sort: 'name', filter: { is_active: 'true' } })
  const brands = useReferentialList('brands', { per_page: 100, sort: 'name', filter: { is_active: 'true' } })
  const [formError, setFormError] = useState<string | null>(null)
  // Création rapide : les détails sont repliés (§3.1) ; sur une fiche, tout est visible.
  const [showMore, setShowMore] = useState(Boolean(product))
  const editable = product ? can('products.update') : can('products.create')

  const form = useForm<ProductForm>({ resolver: zodResolver(productSchema), defaultValues: productToForm(product) })
  const { errors, isDirty } = form.formState
  const type = useWatch({ control: form.control, name: 'type' })
  const unitId = useWatch({ control: form.control, name: 'unit_id' })
  const trackExpiry = useWatch({ control: form.control, name: 'track_expiry' })
  // Unités d'achat possibles : celles dérivées de l'unité du produit (Carton = Unité × 12).
  // Sans unité choisie, le serveur prend l'unité de base au plus petit identifiant (la liste, elle, est triée par nom).
  const baseUnitId = unitId
    ? Number(unitId)
    : units.data?.data.filter((u) => u.base_unit_id === null).reduce<number | undefined>((min, u) => (min === undefined || u.id < min ? u.id : min), undefined)
  const purchaseUnits = units.data?.data.filter((u) => u.base_unit_id !== null && u.base_unit_id === baseUnitId) ?? []
  const baseUnit = units.data?.data.find((u) => u.id === baseUnitId)
  const canSetInitialQuantity = !product && type === 'simple' && can('stock.entry')

  /** « Ajouter et créer un autre » (mise en route) : formulaire vidé pour le produit suivant ; catégorie, unité, type et suivi des dates sont gardés. */
  const startNext = (name: string) => {
    const keep = form.getValues()
    form.reset({
      ...productToForm(),
      category_id: keep.category_id,
      unit_id: keep.unit_id,
      type: keep.type,
      track_expiry: keep.track_expiry,
      expiry_alert_days: keep.expiry_alert_days,
      variants: keep.type === 'variable' ? [emptyVariant()] : [],
    })
    setPendingPhoto(null)
    toast.success(t('products.form.created_next', { name }))
    window.scrollTo({ top: 0 })
    form.setFocus('name')
  }

  /** `next` : après la création, vider le formulaire pour le produit suivant au lieu d'ouvrir la fiche. */
  const submitWith = (next: boolean) => form.handleSubmit((values) => {
    setFormError(null)
    save.mutate(formToPayload(values, product, shop?.id), {
      onSuccess: (saved) => {
        if (product) {
          form.reset(productToForm(saved))
          toast.success(t('common.saved'))
        } else {
          const done = () => {
            if (next) return startNext(saved.name)
            toast.success(t('products.form.created'))
            navigate(`/produits/${saved.id}`, { replace: true })
          }
          if (!pendingPhoto) return void done()
          image.upload.mutate(
            { id: saved.id, file: pendingPhoto.file },
            { onError: (error) => toast.error(t('products.form.photo_failed', { reason: apiErrorMessage(error) })), onSettled: done },
          )
        }
      },
      onError: (error) => setFormError(applyApiErrors(error, form.setError, PRODUCT_FIELDS)),
    })
  })

  const submit = submitWith(false)

  const options = (rows: { id: number; name: string }[] | undefined) => rows?.map((r) => ({ value: String(r.id), label: r.name })) ?? []

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} noValidate className="grid gap-5">
        {formError && <FormAlert>{formError}</FormAlert>}
        <fieldset disabled={!editable} className="grid gap-5">
          <FormSection title={t('products.form.essentials')} description={product ? undefined : t('products.form.essentials_hint')}>
            <FormField id="name" label={t('products.form.name')} error={errors.name?.message}>
              <Input placeholder={t('products.form.name_placeholder')} autoFocus={!product} {...form.register('name')} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              {type === 'variable' ? (
                <p className="self-center text-sm text-muted-foreground">{t('products.form.price_variants')}</p>
              ) : (
                <FormField id="price" label={`${t('products.form.price')} (FCFA)`} error={errors.price?.message}>
                  <Input inputMode="numeric" className="tabular text-lg font-bold" {...form.register('price')} />
                </FormField>
              )}
              {/* La marchandise est souvent déjà là : sa quantité se saisit avec le produit, sans détour par « Mon stock ». */}
              {canSetInitialQuantity && shop && (
                <FormField
                  id="initial_quantity"
                  label={baseUnit ? `${t('products.form.initial_quantity')} (${baseUnit.short_name})` : t('products.form.initial_quantity')}
                  optional
                  hint={t('products.form.initial_quantity_hint', { shop: shop.name })}
                  error={errors.initial_quantity?.message}
                >
                  <Input inputMode="decimal" className="tabular" {...form.register('initial_quantity')} />
                </FormField>
              )}
              <div className="grid content-start gap-2">
                <SelectField
                  control={form.control}
                  name="category_id"
                  label={t('products.form.category')}
                  noneLabel={t('products.form.category_none')}
                  options={options(categories.data?.data)}
                  error={errors.category_id?.message}
                />
                {editable && <QuickReferentialCreate resource="categories" onCreated={(id) => form.setValue('category_id', String(id), { shouldDirty: true })} />}
              </div>
            </div>
            {/* Dates de péremption (§7.11) : accessibles sans le mode avancé, tous les champs facultatifs. */}
            {type !== 'service' && (
              <Controller
                control={form.control}
                name="track_expiry"
                render={({ field }) => (
                  <SwitchField
                    id="track_expiry"
                    label={t('products.form.track_expiry')}
                    hint={t('products.form.track_expiry_hint')}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!editable}
                  />
                )}
              />
            )}
            {type !== 'service' && trackExpiry && (
              <div className="grid gap-4 sm:grid-cols-2">
                {canSetInitialQuantity && shop && (
                  <FormField id="initial_expiry_date" label={t('products.form.initial_expiry_date')} optional hint={t('products.form.initial_expiry_hint')}>
                    <Input type="date" {...form.register('initial_expiry_date')} />
                  </FormField>
                )}
                <FormField
                  id="expiry_alert_days"
                  label={t('products.form.expiry_alert_days')}
                  optional
                  hint={t('products.form.expiry_alert_days_hint')}
                  error={errors.expiry_alert_days?.message}
                >
                  <Input inputMode="numeric" className="tabular" {...form.register('expiry_alert_days')} />
                </FormField>
              </div>
            )}
          </FormSection>

          {!product && (
            <Button type="button" variant="ghost" className="justify-self-start" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
              <ChevronDown className={cn('transition-transform', showMore && 'rotate-180')} aria-hidden="true" />
              {t('products.form.more')}
            </Button>
          )}

          {showMore && (
            <FormSection title={t('products.form.photo')}>
              <PhotoPicker
                id="product-photo"
                imageUrl={product ? product.image_url : (pendingPhoto?.url ?? null)}
                fallback={<ProductThumb name={form.getValues('name')} type={type} className="size-full border-0" />}
                onPick={async (file) => (product ? image.upload.mutateAsync({ id: product.id, file }) : setPendingPhoto(file))}
                onRemove={async () => (product ? image.remove.mutateAsync(product.id) : setPendingPhoto(null))}
                pending={image.upload.isPending || image.remove.isPending}
                disabled={!editable}
                maxSize={400}
              />
            </FormSection>
          )}

          {showMore && (
            <FormSection title={t('products.form.more')}>
              <div className="grid gap-4 sm:grid-cols-2">
                {type !== 'variable' && (
                  <FormField id="cost" label={`${t('products.form.cost')} (FCFA)`} optional hint={t('products.form.cost_hint')} error={errors.cost?.message}>
                    <Input inputMode="numeric" className="tabular" {...form.register('cost')} />
                  </FormField>
                )}
                <SelectField
                  control={form.control}
                  name="unit_id"
                  label={t('products.form.unit')}
                  placeholder={t('products.form.unit_default')}
                  hint={t('products.form.unit_hint')}
                  options={units.data?.data.filter((u) => u.base_unit_id === null).map((u) => ({ value: String(u.id), label: `${u.name} (${u.short_name})` })) ?? []}
                  error={errors.unit_id?.message}
                />
                {type !== 'variable' && (
                  <div className="flex items-end gap-2">
                    <FormField id="barcode" label={t('products.form.barcode')} optional error={errors.barcode?.message} className="flex-1">
                      <Input inputMode="numeric" className="tabular" {...form.register('barcode')} />
                    </FormField>
                    {editable && (
                      <ScanButton
                        className={errors.barcode ? 'mb-7' : undefined}
                        onDetected={(code) => form.setValue('barcode', code, { shouldDirty: true, shouldValidate: true })}
                      />
                  )}
                </div>
                )}
                <FormField id="code" label={t('products.form.code')} optional hint={t('products.form.code_hint')} error={errors.code?.message}>
                  <Input {...form.register('code')} />
                </FormField>
                {type !== 'service' && (
                  <FormField id="stock_alert" label={t('products.form.stock_alert')} optional hint={t('products.form.stock_alert_hint')} error={errors.stock_alert?.message}>
                    <Input inputMode="decimal" className="tabular" {...form.register('stock_alert')} />
                  </FormField>
                )}
              </div>
            </FormSection>
          )}

          {tenant.advanced_mode && showMore && (
            <FormSection title={t('products.form.advanced')} description={t('products.form.variants_soon')}>
              {type !== 'service' && (
                <SelectField
                  control={form.control}
                  name="purchase_unit_id"
                  label={t('products.form.purchase_unit')}
                  noneLabel={t('products.form.purchase_unit_none')}
                  hint={purchaseUnits.length ? t('products.form.purchase_unit_hint') : t('products.form.purchase_unit_empty')}
                  options={purchaseUnits.map((u) => ({
                    value: String(u.id),
                    label: t('products.form.purchase_unit_option', {
                      name: u.name,
                      qty: (u.operator === '/' ? 1 / Number(u.operator_value) : Number(u.operator_value)).toLocaleString('fr-FR'),
                      base: units.data?.data.find((b) => b.id === u.base_unit_id)?.short_name ?? '',
                    }),
                  }))}
                  error={errors.purchase_unit_id?.message}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  control={form.control}
                  name="type"
                  label={t('products.form.type')}
                  // Le stock d'un produit à variantes est tenu par variante : ce type ne change plus après la création.
                  options={
                    product?.type === 'variable'
                      ? [{ value: 'variable', label: t('products.form.type_variable') }]
                      : [
                          { value: 'simple', label: t('products.form.type_simple') },
                          { value: 'service', label: t('products.form.type_service') },
                          ...(product ? [] : [{ value: 'variable', label: t('products.form.type_variable') }]),
                        ]
                  }
                  error={errors.type?.message}
                />
                <div className="grid content-start gap-2">
                  <SelectField
                    control={form.control}
                    name="brand_id"
                    label={t('products.form.brand')}
                    noneLabel={t('products.form.brand_none')}
                    options={options(brands.data?.data)}
                  />
                  {editable && <QuickReferentialCreate resource="brands" onCreated={(id) => form.setValue('brand_id', String(id), { shouldDirty: true })} />}
                </div>
                <FormField id="tax_rate" label={t('products.form.tax_rate')} optional error={errors.tax_rate?.message}>
                  <Input inputMode="decimal" className="tabular" {...form.register('tax_rate')} />
                </FormField>
              </div>
            </FormSection>
          )}
          {type === 'variable' && (
            <VariantsEditor
              control={form.control}
              register={form.register}
              errors={errors}
              stock={!product && shop && can('stock.entry') ? { shopName: shop.name, unit: baseUnit?.short_name ?? '', trackExpiry } : null}
            />
          )}
        </fieldset>

        {editable && (
          <FormActions>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={() => (product ? form.reset() : navigate('/produits'))}>
              {t('common.cancel')}
            </Button>
            {!product && (
              // Mobile : sur sa propre ligne, sous les deux boutons principaux.
              <Button
                type="button"
                variant="outline"
                className="order-last col-span-2 sm:order-none sm:col-span-1"
                disabled={save.isPending || image.upload.isPending}
                onClick={() => void submitWith(true)()}
              >
                <CopyPlus aria-hidden="true" />
                {t('products.form.add_another')}
              </Button>
            )}
            <Button
              type="submit"
              variant="action"
              size="lg"
              disabled={save.isPending || image.upload.isPending || (product && !isDirty)}
            >
              {save.isPending || image.upload.isPending ? t('common.saving') : product ? t('common.save') : t('products.add')}
            </Button>
          </FormActions>
        )}
      </form>

      {product && (
        <>
          <ShopStockSection product={product} />
          {product.type !== 'service' && <ProductSuppliersSection productId={product.id} unit={product.unit.short_name} />}
          {product.type !== 'service' && can('stock.view') && shop && (
            <FormSection title={t('products.recent_movements', { shop: shop.name })}>
              <MovementsPreview productId={product.id} />
              <Button asChild variant="outline" className="justify-self-start">
                <Link to={`/stock/mouvements?product_id=${product.id}`}>
                  <History aria-hidden="true" />
                  {t('products.see_movements')}
                </Link>
              </Button>
            </FormSection>
          )}
          {can('products.disable') && can('products.update') && <AvailabilitySection product={product} />}
        </>
      )}
    </div>
  )
}

function ShopStockSection({ product }: { product: Product }) {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const stock = useProductStock(product.id, product.type !== 'service')
  const [kind, setKind] = useState<AdjustmentKind | null>(null)
  // Les mouvements se font dans la boutique courante, celle de l'en-tête.
  const here = shop ? stock.data?.find((s) => s.shop.id === shop.id) : undefined
  const actions = (
    [
      { kind: 'entry', permission: 'stock.entry', icon: PackagePlus },
      { kind: 'exit', permission: 'stock.exit', icon: PackageMinus },
      { kind: 'inventory', permission: 'stock.adjust', icon: ClipboardCheck },
    ] as const
  ).filter((a) => can(a.permission))
  return (
    <>
      <FormSection title={t('products.stock_by_shop')}>
        {product.type === 'service' ? (
          <p className="text-muted-foreground">{t('products.stock_by_shop_service')}</p>
        ) : stock.isPending ? (
          <LoadingState rows={2} />
        ) : stock.isError ? (
          <ErrorState error={stock.error} onRetry={() => void stock.refetch()} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {stock.data.map((s) => (
              <li key={s.shop.id} className="grid gap-2 rounded-md border-2 border-foreground px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid">
                    <span className="font-bold">{s.shop.name}</span>
                    <span className="tabular text-lg font-bold">
                      {formatQuantity(s.quantity)} <span className="text-sm font-semibold text-muted-foreground">{product.unit.short_name}</span>
                    </span>
                  </span>
                  <StockStateBadge state={s.state} />
                </div>
                {/* Produit à variantes : le stock de chaque variante dans la boutique. */}
                {s.variants.length > 0 && (
                  <ul className="grid gap-1 border-t-2 border-muted pt-2 text-sm">
                    {s.variants.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{v.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="tabular font-bold">
                            {formatQuantity(v.quantity)} {product.unit.short_name}
                          </span>
                          <StockStateBadge state={v.state} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        {here && shop && actions.length > 0 &&
          (product.is_active ? (
            <div className="flex flex-wrap gap-3">
              {actions.map((a, i) => (
                <Button key={a.kind} type="button" variant={i === 0 ? 'default' : 'outline'} onClick={() => setKind(a.kind)}>
                  <a.icon aria-hidden="true" />
                  {t(`products.stock_actions.${a.kind}`)}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('products.stock_actions.inactive')}</p>
          ))}
        {here && shop && <StockQuickSheet kind={kind} onClose={() => setKind(null)} product={product} shop={shop} stock={here} />}
      </FormSection>
      {/* Produit suivi : stock par date dans la boutique courante (§7.11). */}
      {product.track_expiry && here && shop && can('stock.view') && <ProductLotsSection product={product} shop={shop} stock={here} />}
    </>
  )
}

function AvailabilitySection({ product }: { product: Product }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const save = useSaveProduct(product.id)
  const [confirm, setConfirm] = useState(false)

  const setActive = (is_active: boolean) =>
    save.mutate(
      { ...formToPayload(productToForm(product), product, shop?.id), is_active },
      {
        onSuccess: () => {
          setConfirm(false)
          toast.success(is_active ? t('products.status.enabled') : t('products.status.disabled'))
        },
        onError: (error) => {
          setConfirm(false)
          toast.error(apiErrorMessage(error))
        },
      },
    )

  return (
    <FormSection title={t('products.status.title')} description={product.is_active ? t('products.status.active_text') : t('products.status.inactive_text')}>
      {product.is_active ? (
        <Button variant="destructive" className="justify-self-start" onClick={() => setConfirm(true)}>
          <EyeOff aria-hidden="true" />
          {t('products.status.disable')}
        </Button>
      ) : (
        <Button variant="outline" className="justify-self-start" disabled={save.isPending} onClick={() => setActive(true)}>
          <Eye aria-hidden="true" />
          {t('products.status.enable')}
        </Button>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('products.status.disable_title', { name: product.name })}
        description={t('products.status.disable_text')}
        confirmLabel={t('products.status.disable')}
        destructive
        pending={save.isPending}
        onConfirm={() => setActive(false)}
      />
    </FormSection>
  )
}

/** Photo choisie avant la création du produit, avec son adresse locale pour l'aperçu. */
function usePendingPhoto() {
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const current = useRef<typeof photo>(null)
  // L'adresse locale est libérée quand on change de photo ou qu'on quitte la page.
  useEffect(() => () => void (current.current && URL.revokeObjectURL(current.current.url)), [])
  const set = (file: File | null) => {
    if (current.current) URL.revokeObjectURL(current.current.url)
    current.current = file ? { file, url: URL.createObjectURL(file) } : null
    setPhoto(current.current)
  }
  return [photo, set] as const
}
