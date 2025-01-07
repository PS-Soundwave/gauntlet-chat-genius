import "./globals.css"
import { Inter } from "next/font/google"
import { colors } from "@/utils/colors"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "ChatGenius",
  description: "Workplace communication made simple",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} ${colors.background} ${colors.foreground} h-full`}>
        {children}
      </body>
    </html>
  )
}

