import { Suspense } from "react"

import LoginForm from "./LoginForm"

type LoginPageProps = {
  searchParams?: Promise<{
    from?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams
  const from = resolvedSearchParams?.from ?? "/"

  return (
    <Suspense>
      <LoginForm from={from} />
    </Suspense>
  )
}
