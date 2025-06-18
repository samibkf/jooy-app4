# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/78bf6fd2-fced-4388-a124-42351d103fed

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/78bf6fd2-fced-4388-a124-42351d103fed) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/78bf6fd2-fced-4388-a124-42351d103fed) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Supabase Setup

### Environment Variables

The following environment variables need to be set in your Supabase project:

1. **PDF_ENCRYPTION_KEY**: A 32-character string used for AES-256 encryption of PDF files
   - Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
   - This should be set as a secret in your Supabase project settings

### Setting up Supabase Secrets

1. Go to your Supabase project dashboard
2. Navigate to Settings > Edge Functions
3. Add the following secret:
   - Name: `PDF_ENCRYPTION_KEY`
   - Value: Your 32-character encryption key

### Storage Buckets

The application expects the following storage buckets:

1. **private-pdfs**: For secure PDF storage (private access)
2. **pdfs**: For fallback PDF storage (public access)

### Edge Functions

The following Edge Functions are implemented:

1. **get-encrypted-worksheet**: Securely fetches and encrypts PDF data
2. **get-worksheet-data**: Fallback function for basic worksheet data

### Database Schema

The application uses the following tables:

- `worksheets`: Stores worksheet metadata
- `regions`: Stores interactive regions for each worksheet

Run the migrations in the `supabase/migrations` folder to set up the database schema.