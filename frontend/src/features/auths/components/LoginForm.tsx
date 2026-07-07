import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
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
import { loginSchema } from '@/lib/validations/auth.schema'
import { useLogin } from '../hooks/useLogin'
import type { LoginFormValues } from '../types/auth.types'

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const { mutate: login, isPending } = useLogin()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const onSubmit = (values: LoginFormValues) => {
    login(values)
  }

  return (
    <Card className="w-full max-w-[27.5rem] rounded-lg border-border/70 bg-card/95 py-7 shadow-2xl shadow-brand-navy/10 backdrop-blur">
      <CardHeader className="space-y-3 px-6 pb-2 text-left sm:px-8">
        <div className="inline-flex w-fit items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          Đăng nhập nhân sự
        </div>
        <CardTitle className="text-2xl font-semibold leading-tight sm:text-3xl">
          Chào mừng trở lại
        </CardTitle>
        <CardDescription className="max-w-sm leading-6">
          Truy cập {APP_NAME} để tiếp tục xử lý đơn thuốc, tồn kho và ca trực.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 sm:px-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="duocsi@pharmapp.vn"
                      autoComplete="email"
                      disabled={isPending}
                      className="h-11 rounded-lg bg-input-background px-4"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password */}
            <FormField
              control={form.control}
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
                        disabled={isPending}
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

            {/* Remember me */}
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
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
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang đăng nhập...
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
      </CardContent>
    </Card>
  )
}
