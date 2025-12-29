import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Link } from "react-router-dom"

export default function Login() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Autentificare</CardTitle>
          <CardDescription>Introdu datele pentru a accesa platforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="admin@primarie.ro" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Parolă</Label>
              <Input id="password" type="password" />
            </div>
            <Button className="w-full">Intră în cont</Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Nu ai cont? <Link to="/register" className="text-blue-600 hover:underline">Înregistrează-te</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}