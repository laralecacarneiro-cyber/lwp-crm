// Variables the frontend will substitute at draft time:
//   {{contact_name}}   - person's first name (or "there" fallback)
//   {{org_name}}       - organisation name
//   {{category}}       - category e.g. "sector cluster"
//   {{why_relevant}}   - one-liner from the org record
//   {{sender_name}}    - Lara
//   {{sender_role}}    - Head of Business Development
//   {{sender_email}}   - info@leadingwithppl.com
//   {{intro_source}}   - name of who suggested the intro (for warm outreach)
//   {{meeting_recap}}  - one line summary the user types in
//   {{next_step}}      - one line next step the user types in
//   {{referral_type}}  - the type of client you're asking them to refer

const templates = [
  // ============ 1. FIRST OUTREACH, COLD ============
  {
    purpose: 'first_cold',
    language: 'en',
    purpose_label: 'First outreach, cold',
    subject: 'Introducing Leading with People — {{org_name}}',
    body: `Dear {{contact_name}},

I lead business development at Leading with People, a Portuguese consultancy that helps foreign companies set up and run their operations in Portugal. We handle the practical work of company registration, HR and payroll, office setup, and ongoing operations, so international teams have one point of contact instead of five suppliers.

I am reaching out because {{org_name}} sits at the point where many of the foreign companies we serve start their journey. {{why_relevant}}

Would you be open to a short conversation to explore how we might work together? I am happy to come to you, or to talk by video.

Kind regards,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}
leadingwithppl.com`,
    sort_order: 1
  },
  {
    purpose: 'first_cold',
    language: 'pt',
    purpose_label: 'Primeiro contacto, a frio',
    subject: 'Apresentação da Leading with People — {{org_name}}',
    body: `Cara {{contact_name}}, caro {{contact_name}},

Sou responsável pelo desenvolvimento de negócio na Leading with People, uma consultora portuguesa que apoia empresas estrangeiras a estabelecerem e gerirem operações em Portugal. Tratamos da parte prática, constituição da sociedade, recursos humanos, folha de pagamentos, escritório e operação corrente, para que as equipas internacionais tenham um único ponto de contacto em vez de cinco fornecedores.

Escrevo-lhe porque a {{org_name}} está no início do percurso de muitas das empresas que apoiamos. {{why_relevant}}

Estaria disponível para uma conversa curta para explorarmos formas de colaboração? Posso deslocar-me ou fazer por videochamada, o que for mais conveniente.

Com os melhores cumprimentos,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}
leadingwithppl.com`,
    sort_order: 1
  },

  // ============ 2. FIRST OUTREACH, WARM INTRO ============
  {
    purpose: 'first_warm',
    language: 'en',
    purpose_label: 'First outreach, warm intro',
    subject: '{{intro_source}} suggested we connect — Leading with People',
    body: `Dear {{contact_name}},

{{intro_source}} suggested I get in touch with you.

I lead business development at Leading with People, a Portuguese consultancy that helps foreign companies set up and run their operations in Portugal. We handle the practical work of company registration, HR and payroll, office setup, and ongoing operations, so international teams have one accountable point of contact.

{{why_relevant}}

I would welcome a short conversation, in person if you are in the Porto or Braga area, or by video otherwise. Would sometime in the next two weeks work for you?

Kind regards,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}
leadingwithppl.com`,
    sort_order: 2
  },
  {
    purpose: 'first_warm',
    language: 'pt',
    purpose_label: 'Primeiro contacto, com introdução',
    subject: 'A {{intro_source}} sugeriu que conversássemos — Leading with People',
    body: `Cara {{contact_name}}, caro {{contact_name}},

A {{intro_source}} sugeriu que entrasse em contacto consigo.

Sou responsável pelo desenvolvimento de negócio na Leading with People, uma consultora portuguesa que apoia empresas estrangeiras a estabelecerem e gerirem operações em Portugal. Tratamos da parte prática, constituição da sociedade, recursos humanos, folha de pagamentos, escritório e operação corrente, para que as equipas internacionais tenham um único ponto de contacto responsável.

{{why_relevant}}

Gostaria de agendar uma conversa curta, presencialmente se estiver na zona do Porto ou Braga, ou por videochamada. Alguma disponibilidade nas próximas duas semanas?

Com os melhores cumprimentos,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}
leadingwithppl.com`,
    sort_order: 2
  },

  // ============ 3. FOLLOW-UP AFTER SILENCE ============
  {
    purpose: 'follow_up',
    language: 'en',
    purpose_label: 'Follow-up after silence',
    subject: 'Following up — Leading with People',
    body: `Dear {{contact_name}},

I hope this note finds you well. I wanted to gently follow up on my previous message, since I know inboxes can be full.

Leading with People helps foreign companies set up and run their operations in Portugal, taking on the practical work so international teams have one accountable point of contact. I still believe there is a useful conversation to be had between us given {{org_name}}'s role.

If this is not the right moment, no need to reply. I will happily circle back in a few months. If it is, even a short call in the next couple of weeks would be great.

Kind regards,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}`,
    sort_order: 3
  },
  {
    purpose: 'follow_up',
    language: 'pt',
    purpose_label: 'Seguimento após silêncio',
    subject: 'A retomar contacto — Leading with People',
    body: `Cara {{contact_name}}, caro {{contact_name}},

Espero que esteja tudo bem. Escrevo apenas para retomar a mensagem anterior, uma vez que sei bem como as caixas de correio ficam cheias.

A Leading with People apoia empresas estrangeiras a estabelecerem e gerirem operações em Portugal, tratando da parte prática para que as equipas internacionais tenham um único ponto de contacto responsável. Continuo a acreditar que haveria valor numa conversa entre nós, dado o papel da {{org_name}}.

Se este não for o momento certo, não precisa responder. Voltarei a escrever daqui a alguns meses. Se for, uma conversa curta nas próximas duas semanas seria ótima.

Com os melhores cumprimentos,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}`,
    sort_order: 3
  },

  // ============ 4. THANK YOU AFTER MEETING ============
  {
    purpose: 'thank_you',
    language: 'en',
    purpose_label: 'Thank you after meeting',
    subject: 'Thank you — great to meet',
    body: `Dear {{contact_name}},

Thank you for taking the time to meet today. It was genuinely useful to hear about your work at {{org_name}} and where you see the strongest points of alignment.

Quick recap of what we agreed: {{meeting_recap}}

Next step: {{next_step}}

I will be in touch again shortly. In the meantime, do let me know if there is anything I can send through that would be helpful.

Kind regards,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}`,
    sort_order: 4
  },
  {
    purpose: 'thank_you',
    language: 'pt',
    purpose_label: 'Agradecimento após reunião',
    subject: 'Obrigada pela conversa',
    body: `Cara {{contact_name}}, caro {{contact_name}},

Obrigada pelo tempo que dedicou à reunião de hoje. Foi genuinamente útil ouvir sobre o trabalho na {{org_name}} e perceber onde vê os pontos de maior alinhamento.

Breve resumo do que combinámos: {{meeting_recap}}

Próximo passo: {{next_step}}

Estarei em contacto novamente em breve. Entretanto, diga-me se houver algo que possa enviar-lhe que seja útil.

Com os melhores cumprimentos,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}`,
    sort_order: 4
  },

  // ============ 5. PROPOSE A CALL ============
  {
    purpose: 'propose_call',
    language: 'en',
    purpose_label: 'Propose a call',
    subject: '30 minute call? — Leading with People',
    body: `Dear {{contact_name}},

Following on from our recent exchanges, would you have 30 minutes for a call in the next two weeks?

The purpose would be to explore how Leading with People and {{org_name}} might work together. Specifically, I would like to walk through the kind of foreign companies we serve, understand the profile you tend to encounter, and see where there is a natural fit.

Some options that work for me:
- (option 1)
- (option 2)
- (option 3)

Happy to move to any other slot if none of those work.

Kind regards,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}`,
    sort_order: 5
  },
  {
    purpose: 'propose_call',
    language: 'pt',
    purpose_label: 'Propor uma chamada',
    subject: 'Videochamada de 30 minutos? — Leading with People',
    body: `Cara {{contact_name}}, caro {{contact_name}},

Na sequência da nossa troca recente, teria disponibilidade para uma videochamada de 30 minutos nas próximas duas semanas?

O objectivo seria explorar como a Leading with People e a {{org_name}} podem colaborar. Concretamente, gostaria de partilhar o tipo de empresas estrangeiras que apoiamos, perceber o perfil que normalmente encontram e ver onde existe encaixe natural.

Deixo algumas opções da minha parte:
- (opção 1)
- (opção 2)
- (opção 3)

Fico disponível para outro horário se nenhum destes servir.

Com os melhores cumprimentos,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}`,
    sort_order: 5
  },

  // ============ 6. QUARTERLY CHECK-IN ============
  {
    purpose: 'quarterly_checkin',
    language: 'en',
    purpose_label: 'Quarterly check-in',
    subject: 'Keeping in touch — Leading with People',
    body: `Dear {{contact_name}},

A quick note to keep the line open between us.

At Leading with People we have had a busy quarter helping foreign companies land and operate in Portugal, and I wanted to check in briefly on what has been happening at {{org_name}}.

Is there anything on your side where a conversation would be useful, or any client-side pattern you have been seeing that I should know about?

Happy to make time for a short call if that would be easier than trading messages.

Kind regards,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}`,
    sort_order: 6
  },
  {
    purpose: 'quarterly_checkin',
    language: 'pt',
    purpose_label: 'Contacto trimestral',
    subject: 'A manter contacto — Leading with People',
    body: `Cara {{contact_name}}, caro {{contact_name}},

Uma nota breve para manter o canal aberto entre nós.

Na Leading with People tivemos um trimestre dedicado a apoiar empresas estrangeiras a instalarem-se e operarem em Portugal, e queria perceber como tem corrido o trabalho na {{org_name}}.

Há algo do vosso lado onde uma conversa seria útil, ou algum padrão do lado dos clientes que tenham observado e que valha a pena partilhar?

Fico disponível para uma chamada curta se for mais fácil do que trocar mensagens.

Com os melhores cumprimentos,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}`,
    sort_order: 6
  },

  // ============ 7. REFERRAL REQUEST ============
  {
    purpose: 'referral_request',
    language: 'en',
    purpose_label: 'Referral request',
    subject: 'A specific ask — Leading with People',
    body: `Dear {{contact_name}},

I want to make a specific request rather than dance around it.

We are actively looking to speak with {{referral_type}}. Given {{org_name}}'s network, I imagine you cross paths with these profiles regularly.

If anyone comes to mind, I would appreciate an introduction, even a warm mention that they can follow up on. In return, when we come across companies that would benefit from your work, we make the same connection.

If nothing comes to mind right now, no problem. This request will keep. And if there is anything I can do in the other direction, tell me.

Kind regards,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}`,
    sort_order: 7
  },
  {
    purpose: 'referral_request',
    language: 'pt',
    purpose_label: 'Pedido de referência',
    subject: 'Um pedido concreto — Leading with People',
    body: `Cara {{contact_name}}, caro {{contact_name}},

Vou ser directa em vez de dar voltas ao pedido.

Estamos activamente a procurar falar com {{referral_type}}. Dada a rede da {{org_name}}, imagino que se cruze com estes perfis com regularidade.

Se lhe vier alguém à cabeça, agradeço uma introdução, ou mesmo apenas uma menção que essa pessoa possa depois seguir. Em contrapartida, quando encontrarmos empresas que beneficiariam do vosso trabalho, fazemos a mesma ponte.

Se agora não houver ninguém, não há problema. O pedido fica em aberto. E se houver alguma coisa que possa fazer no sentido inverso, diga.

Com os melhores cumprimentos,
{{sender_name}}
{{sender_role}}
Leading with People
{{sender_email}}`,
    sort_order: 7
  }
];

module.exports = templates;
