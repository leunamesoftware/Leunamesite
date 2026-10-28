/* CONFIGURAÇÃO DA LOJA — leunamesoftware.com (Europa: Espanha + Portugal)
   paypalClientId: o "Client ID" da sua conta PayPal Business (é público, não é senha).
     PayPal → developer.paypal.com → Apps & Credentials → Live → criar app → copiar Client ID.
     Enquanto estiver vazio, o carrinho mostra "pagamento em breve" + contacto por email.
   titular: nome, morada e NIF/CNPJ do vendedor (a lei da UE exige no aviso legal).
   NUNCA coloque aqui o "Secret" do PayPal nem a chave da CJ. */
window.CONFIG = {
  paypalClientId: "",
  email: "leunamesoftware@gmail.com",
  titular: "Emanuel da Silva Antunes Coletto (marcas LeunaPets y Cachik) · Estrada de Xerém, s/n, Parque Xerém, Duque de Caxias, RJ, CEP 25241-390, Brasil",
  marca: "Cachik"
};
