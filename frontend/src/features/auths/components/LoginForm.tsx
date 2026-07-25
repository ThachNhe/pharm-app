import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { APP_NAME } from '@/lib/constants'
import { loginOtpSchema, loginSchema } from '@/lib/validations/auth.schema'
import { useLogin, useVerifyLoginOtp } from '../hooks/useLogin'
import type { LoginChallengeResponse, LoginFormValues, LoginOtpFormValues } from '../types/auth.types'

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [challenge, setChallenge] = useState<LoginChallengeResponse | null>(null)

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const otpForm = useForm<LoginOtpFormValues>({
    resolver: zodResolver(loginOtpSchema),
    defaultValues: {
      code: '',
    },
  })

  const { mutate: requestOtp, isPending: isRequestingOtp } = useLogin((nextChallenge) => {
    setChallenge(nextChallenge)
    otpForm.reset({ code: '' })
  })
  const { mutate: verifyLoginOtp, isPending: isVerifyingOtp } = useVerifyLoginOtp()

  const onCredentialsSubmit = (values: LoginFormValues) => {
    requestOtp(values)
  }

  const onOtpSubmit = (values: LoginOtpFormValues) => {
    if (!challenge) return
    verifyLoginOtp({
      challengeId: challenge.challengeId,
      code: values.code,
    })
  }

  const handleBackToCredentials = () => {
    setChallenge(null)
    otpForm.reset({ code: '' })
  }

  return (
    <Card className="w-full max-w-[27.5rem] rounded-lg border-border/70 bg-card/95 py-7 shadow-2xl shadow-brand-navy/10 backdrop-blur">
      <CardHeader className="space-y-3 px-6 pb-2 text-left sm:px-8">
        <div className="inline-flex w-fit items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          Đăng nhập nhân sự
        </div>
        <CardTitle className="text-2xl font-semibold leading-tight sm:text-3xl">
          {challenge ? 'Xác minh đăng nhập' : 'Chào mừng trở lại'}
        </CardTitle>
        <CardDescription className="max-w-sm leading-6">
          {challenge
            ? `Mã 6 số đã được gửi tới ${challenge.email}.`
            : `Truy cập ${APP_NAME} để tiếp tục xử lý đơn thuốc, tồn kho và ca trực.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 sm:px-8">
        {challenge ? (
          <Form {...otpForm}>
            <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-5">
              <FormField
                control={otpForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã xác minh</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder=""
                        autoFocus
                        disabled={isVerifyingOtp}
                        className="h-11 rounded-lg bg-input-background px-4 text-center text-lg font-semibold"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(event) => {
                          otpForm.setValue('code', event.target.value.replace(/\D/g, '').slice(0, 6), {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          })
                        }}
                        onPaste={(event) => {
                          event.preventDefault()
                          otpForm.setValue('code', event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6), {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          })
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="h-11 w-full rounded-lg shadow-lg shadow-primary/20"
                disabled={isVerifyingOtp}
              >
                {isVerifyingOtp ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang xác minh...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    Xác minh
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full rounded-lg"
                disabled={isVerifyingOtp}
                onClick={handleBackToCredentials}
              >
                <ArrowLeft className="size-4" />
                Nhập lại email
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onCredentialsSubmit)} className="space-y-5">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="duocsi@pharmapp.vn"
                        autoComplete="email"
                        disabled={isRequestingOtp}
                        className="h-11 rounded-lg bg-input-background px-4"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Mật khẩu</FormLabel>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          disabled={isRequestingOtp}
                          className="h-11 rounded-lg bg-input-background px-4 pr-11"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isRequestingOtp}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer text-sm font-normal text-muted-foreground">
                      Ghi nhớ đăng nhập
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="h-11 w-full rounded-lg shadow-lg shadow-primary/20"
                disabled={isRequestingOtp}
              >
                {isRequestingOtp ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang gửi mã...
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Đăng nhập
                  </>
                )}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  )
}
