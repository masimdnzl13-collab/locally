import AddCustomerForm from "@/components/panel/add-customer-form";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 font-display text-2xl font-medium tracking-tight text-ink-900">
        Müşteri Ekle
      </h1>
      <AddCustomerForm />
    </div>
  );
}
