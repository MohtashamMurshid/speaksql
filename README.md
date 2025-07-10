# 🗣️ SpeakSQL

**Talk to your data in plain English**

SpeakSQL is an intelligent database interface that lets you query your data using natural language. Upload CSV files, connect to databases, and get insights through an AI-powered chat interface with speech-to-text capabilities.

![SpeakSQL Demo](https://via.placeholder.com/800x400/4f46e5/ffffff?text=SpeakSQL+Demo)

## ✨ Features

### 🔄 Data Import & Management

- **CSV Upload**: Drag-and-drop CSV files with automatic schema detection
- **Database Connections**: Connect to PostgreSQL, MySQL, and SQLite databases (coming soon)
- **Schema Visualization**: Interactive database schema viewer with relationships

### 🤖 AI-Powered Querying

- **Natural Language**: Ask questions in plain English
- **SQL Generation**: AI automatically generates optimized SQL queries
- **Speech-to-Text**: Use voice commands to query your data
- **Smart Suggestions**: Get contextual query suggestions based on your schema

### 📊 Query Execution & Results

- **Live Query Editor**: Write and test SQL queries with syntax highlighting
- **Real-time Results**: Execute queries and view formatted results
- **Export Options**: Export results in multiple formats (JSON, CSV, Excel)
- **Query History**: Track and re-run previous queries

### 🎨 Modern Interface

- **Dark/Light Theme**: Toggle between themes for comfortable viewing
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-time Updates**: Live schema updates as you import new data

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/speaksql.git
   cd speaksql
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

5. **Set Your OpenAI API Key**

   SpeakSQL uses OpenAI for natural language to SQL conversion.  
   To enable this, create a `.env.local` file in the project root and add your OpenAI API key:

   ```
   OPENAI_API_KEY=sk-...
   ```

   You can get your API key from [OpenAI's dashboard](https://platform.openai.com/account/api-keys).  
   **Never share or commit your API key publicly.**

## 📖 How to Use

### 1. Import Your Data

- Go to the **"Import Data"** tab
- Drag and drop your CSV files or click to browse
- Watch as SpeakSQL automatically detects your data schema

### 2. Explore Your Schema

- Switch to the **"Schema"** tab to visualize your data structure
- See tables, columns, data types, and relationships
- Use this information to understand your data better

### 3. Start Querying

- Head to the **"Chat"** tab for natural language queries
- Or use the **"Query Editor"** for direct SQL access
- Try questions like:
  - "Show me all customers from New York"
  - "What's the average order value?"
  - "Find the top 10 selling products"

### 4. Execute and Analyze

- Click the **Execute** button to run AI-generated queries
- View formatted results in interactive tables
- Export results for further analysis

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **AI Integration**: Vercel AI SDK
- **Database**: In-memory SQL engine (with external DB support planned)
- **Speech**: Web Speech API for voice commands

## 📁 Project Structure

```
SpeakSQL/
├── app/                    # Next.js app directory
│   ├── api/chat/          # AI chat API endpoint
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main application page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── data-importer.tsx # CSV upload interface
│   ├── database-chat.tsx # AI chat interface
│   ├── query-editor.tsx  # SQL query editor
│   └── schema-visualizer.tsx # Database schema viewer
├── lib/                  # Utility libraries
│   ├── database-service.ts # Database abstraction layer
│   └── utils.ts          # Helper functions
└── public/               # Static assets
```

## 🔮 Roadmap

### Current Status

- ✅ CSV Import functionality
- ✅ Basic SQL query execution
- ✅ AI chat interface with speech-to-text
- ✅ Schema visualization
- ⚠️ Query execution in chat (in progress)
- ❌ External database connections
- ❌ Advanced SQL features (JOINs, aggregations)

### Coming Soon

- 🔄 **External Database Support**: Direct connections to PostgreSQL, MySQL, SQLite
- 📊 **Advanced Analytics**: Statistical analysis and data insights
- 🔍 **Query Optimization**: Performance suggestions and query plans
- 📱 **Mobile App**: Native iOS and Android applications
- 🔐 **Enterprise Features**: User management, access controls, audit logs

See [TODO.md](./TODO.md) for detailed development tasks.

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow our coding standards
4. **Test thoroughly**: Ensure everything works
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**: Describe your changes

### Development Guidelines

- Use TypeScript for type safety
- Follow the existing code style
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check our [Wiki](https://github.com/yourusername/speaksql/wiki)
- **Issues**: Report bugs on [GitHub Issues](https://github.com/yourusername/speaksql/issues)
- **Discussions**: Join conversations in [GitHub Discussions](https://github.com/yourusername/speaksql/discussions)
- **Email**: contact@speaksql.com

---

**Made with ❤️ by the SpeakSQL team**

_Transform the way you interact with data - one conversation at a time._
