# Bases de données et outils d'enrichissement OSINT — France

## 🇫🇷 Registres d'entreprises (données publiques, gratuites)

### Pappers.fr ⭐ Priorité 1
- **URL** : https://www.pappers.fr
- **Données** : SIREN/SIRET, dirigeants (noms + adresses perso dans les statuts), bilans, statuts (PDF), actes, annonces BODACC
- **Gratuit** : Oui (accès complet aux fiches, PDFs des statuts et actes)
- **Astuce OSINT** : Les statuts de société contiennent souvent l'adresse personnelle du fondateur
- **Google dork** : `"Nom Prénom" site:pappers.fr` ou `"Nom" filetype:pdf site:pappers.fr`

### Societe.com
- **URL** : https://www.societe.com
- **Données** : Fiches entreprises, dirigeants, établissements, chiffre d'affaires
- **Gratuit** : Données de base gratuites, détails payants
- **Google dork** : `"Nom Prénom" site:societe.com dirigeant`

### Infogreffe.fr
- **URL** : https://www.infogreffe.fr
- **Données** : Kbis, comptes annuels, actes officiels
- **Gratuit** : Recherche gratuite, documents payants

### Verif.com
- **URL** : https://www.verif.com
- **Données** : Fiches entreprises, dirigeants, données financières
- **Gratuit** : Oui pour les infos de base

### BODACC (Bulletin Officiel des Annonces Civiles et Commerciales)
- **URL** : https://www.bodacc.fr
- **Données** : Créations, modifications, radiations, ventes de fonds de commerce
- **Gratuit** : Oui, source officielle

### INPI (Institut National de la Propriété Industrielle)
- **URL** : https://data.inpi.fr
- **Données** : Marques déposées, brevets (contient le nom du déposant)
- **Gratuit** : Oui

### Datalegal.fr
- **URL** : https://www.datalegal.fr
- **Données** : Mandats sociaux d'un dirigeant (toutes ses sociétés)
- **Gratuit** : Oui
- **Astuce** : Tapez un nom pour voir TOUTES les sociétés où la personne est dirigeante

---

## 📞 Outils d'enrichissement de contacts

### RocketReach ⭐ Priorité 1
- **URL** : https://rocketreach.co
- **Gratuit** : 5 lookups/mois
- **Données** : Emails professionnels/perso, numéros de téléphone (portables !), profils sociaux
- **Méthode** : Chercher le nom → voir les données partielles → utiliser un crédit gratuit pour révéler

### ContactOut
- **URL** : https://contactout.com
- **Gratuit** : Extension Chrome, quelques crédits gratuits
- **Données** : Emails et téléphones depuis les profils LinkedIn
- **Méthode** : Installer l'extension → aller sur le profil LinkedIn → ContactOut affiche les données

### Kaspr ⭐ Pour les portables FR
- **URL** : https://www.kaspr.io
- **Gratuit** : Extension Chrome + crédits gratuits à l'inscription
- **Données** : Numéros de portable français directs, emails
- **Méthode** : Extension Chrome sur LinkedIn → révèle le portable
- **Avantage** : Spécialisé sur les données françaises

### Lusha
- **URL** : https://www.lusha.com
- **Gratuit** : 5 crédits/mois
- **Données** : Téléphones directs, emails

### Apollo.io
- **URL** : https://www.apollo.io
- **Gratuit** : 50 crédits/mois
- **Données** : Emails, téléphones, firmographics
- **Avantage** : Filtrage avancé par industrie, taille d'entreprise, fonction

### Hunter.io
- **URL** : https://hunter.io
- **Gratuit** : 25 recherches/mois
- **Données** : Emails professionnels (pattern d'email de l'entreprise)

---

## 🔍 Google Dorks pour l'OSINT

### Recherche de documents
```
"Nom Prénom" filetype:pdf                    # CV, rapports, statuts, bilans
"Nom Prénom" filetype:pptx OR filetype:ppt   # Présentations
"Nom Prénom" filetype:doc OR filetype:docx    # Documents Word
"Nom Prénom" filetype:xls OR filetype:xlsx    # Tableurs
```

### Recherche de numéros de téléphone
```
"Nom Prénom" ("06" OR "07" OR "+33 6" OR "+33 7")   # Portables FR
"Nom Prénom" (telephone OR mobile OR portable)        # Mentions de tel
"Nom Prénom" (CV OR resume OR curriculum)              # CV avec coordonnées
```

### Recherche sur des sites spécifiques
```
"Nom" site:pappers.fr                         # Registre entreprises
"Nom" site:societe.com                        # Registre entreprises
"Nom" site:linkedin.com/in/                   # Profil LinkedIn
"Nom" site:rocketreach.co                     # Enrichissement
"Nom" site:contactout.com                     # Enrichissement
```

### Recherche de données perso dans des statuts/actes
```
"Nom Prénom" "demeurant" site:pappers.fr      # Adresse perso dans statuts
"Nom Prénom" inurl:statuts filetype:pdf       # Statuts de société
"Nom Prénom" "né(e) le"                       # Date de naissance
```

---

## 📱 Réseaux sociaux et profils publics

### LinkedIn
- Profils professionnels, parcours, connexions
- Avec Kaspr/ContactOut/Lusha → révèle les portables

### Instagram
- DM pour contact direct (surtout influenceurs)
- Le bouton "Contact" affiche souvent l'email pro

### Pages Jaunes / 118712
- **URL** : https://www.pagesjaunes.fr / https://www.118712.fr
- Pour les numéros de téléphone fixes et professionnels

### YouTube
- Les descriptions de vidéos contiennent parfois des emails de contact
- Les chaînes business ont un onglet "À propos" avec contact

---

## Escalation recommandée (coût croissant)

| Niveau | Sources | Coût |
|--------|---------|------|
| 1. Gratuit | Google dorks, Pappers, Societe.com, BODACC, INPI | 0€ |
| 2. Freemium | RocketReach (5/mois), Kaspr (gratuit), Apollo (50/mois) | 0€ |
| 3. Cheap | Jina search, Tavily search | ~$0.01 |
| 4. Medium | Apify scrapers, ContactOut | ~$0.10 |
| 5. Premium | Perplexity Deep, Exa Deep | ~$0.50 |
