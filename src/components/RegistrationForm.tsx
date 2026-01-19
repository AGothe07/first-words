import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2, AlertCircle, User, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Validation schema
const registrationSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, { message: "Nome deve ter pelo menos 2 caracteres" })
    .max(50, { message: "Nome deve ter no máximo 50 caracteres" })
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, { message: "Nome deve conter apenas letras" }),
  sobrenome: z
    .string()
    .trim()
    .min(2, { message: "Sobrenome deve ter pelo menos 2 caracteres" })
    .max(50, { message: "Sobrenome deve ter no máximo 50 caracteres" })
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, { message: "Sobrenome deve conter apenas letras" }),
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido" })
    .refine((email) => email.includes(".takeat@"), {
      message: "Apenas emails com .takeat@ são aceitos (ex: arthur.takeat@gmail.com)",
    }),
  celular: z
    .string()
    .regex(/^\(\d{2}\) \d{5}-\d{4}$/, {
      message: "Celular deve estar no formato (99) 99999-9999",
    }),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

type SubmitStatus = "idle" | "loading" | "success" | "error";

const RegistrationForm = () => {
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    watch,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: "onBlur",
  });

  // Phone mask function
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) {
      return numbers.length ? `(${numbers}` : "";
    }
    if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setValue("celular", formatted, { shouldValidate: true });
  };

  const onSubmit = async (data: RegistrationFormData) => {
    setSubmitStatus("loading");
    setStatusMessage("");

    // Extract only numbers from phone
    const celularNumbers = data.celular.replace(/\D/g, "");

    const payload = {
      nome: data.nome,
      sobrenome: data.sobrenome,
      email: data.email,
      celular: celularNumbers,
    };

    try {
      // Fire and forget - não espera resposta
      fetch("https://webhook.takeat.cloud/webhook/criar_aluno_frappe", {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Sempre mostra sucesso após disparar a requisição
      setSubmitStatus("success");
      setStatusMessage("Cadastro enviado com sucesso!");
      reset();
    } catch (error) {
      setSubmitStatus("error");
      setStatusMessage("Erro ao enviar. Tente novamente.");
    }
  };

  const celularValue = watch("celular") || "";

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card rounded-2xl shadow-xl border border-border p-8 md:p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Criar Conta
          </h1>
          <p className="text-muted-foreground">
            Preencha seus dados para criar sua conta
          </p>
        </div>

        {/* Status Messages */}
        {submitStatus === "success" && (
          <div className="mb-6 p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
            <p className="text-success text-sm font-medium">{statusMessage}</p>
          </div>
        )}

        {submitStatus === "error" && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-destructive text-sm font-medium">{statusMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome" className="text-foreground font-medium">
              Nome <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <Input
                id="nome"
                type="text"
                placeholder="Digite seu nome"
                className={cn(
                  "h-12 pl-4 pr-4 transition-all duration-200",
                  "border-2 focus:border-primary focus:ring-2 focus:ring-primary/20",
                  errors.nome && "border-destructive focus:border-destructive focus:ring-destructive/20"
                )}
                {...register("nome")}
              />
            </div>
            {errors.nome && (
              <p className="text-destructive text-sm flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {errors.nome.message}
              </p>
            )}
          </div>

          {/* Sobrenome */}
          <div className="space-y-2">
            <Label htmlFor="sobrenome" className="text-foreground font-medium">
              Sobrenome <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <Input
                id="sobrenome"
                type="text"
                placeholder="Digite seu sobrenome"
                className={cn(
                  "h-12 pl-4 pr-4 transition-all duration-200",
                  "border-2 focus:border-primary focus:ring-2 focus:ring-primary/20",
                  errors.sobrenome && "border-destructive focus:border-destructive focus:ring-destructive/20"
                )}
                {...register("sobrenome")}
              />
            </div>
            {errors.sobrenome && (
              <p className="text-destructive text-sm flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {errors.sobrenome.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground font-medium">
              Email <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seunome.takeat@email.com"
                className={cn(
                  "h-12 pl-12 pr-4 transition-all duration-200",
                  "border-2 focus:border-primary focus:ring-2 focus:ring-primary/20",
                  errors.email && "border-destructive focus:border-destructive focus:ring-destructive/20"
                )}
                {...register("email")}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Apenas emails com .takeat@ são aceitos (ex: arthur.takeat@gmail.com)
            </p>
            {errors.email && (
              <p className="text-destructive text-sm flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Celular */}
          <div className="space-y-2">
            <Label htmlFor="celular" className="text-foreground font-medium">
              Celular <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="celular"
                type="tel"
                placeholder="(99) 99999-9999"
                value={celularValue}
                onChange={handlePhoneChange}
                maxLength={15}
                className={cn(
                  "h-12 pl-12 pr-4 transition-all duration-200",
                  "border-2 focus:border-primary focus:ring-2 focus:ring-primary/20",
                  errors.celular && "border-destructive focus:border-destructive focus:ring-destructive/20"
                )}
              />
            </div>
            {errors.celular && (
              <p className="text-destructive text-sm flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {errors.celular.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={submitStatus === "loading"}
            className="w-full h-12 text-base font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            {submitStatus === "loading" ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Criar Conta"
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-sm mt-6">
          Todos os campos marcados com{" "}
          <span className="text-primary font-medium">*</span> são obrigatórios
        </p>
      </div>
    </div>
  );
};

export default RegistrationForm;
