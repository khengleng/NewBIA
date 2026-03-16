# CamboBia Mobile 🇰🇭

The premium mobile companion for the Boutique Advisory Platform. Built with Flutter.

## Core Features
1. **Investment Dashboard**: Real-time view of portfolio value, active investments, and annual yields.
2. **SME Marketplace**: High-fidelity deal cards for institutional Grade-A SME investments.
3. **Unified Bot Assistant**: Deep link to our Telegram bot for active trading (Buy orders & order book).
4. **Secure Auth**: JWT-based session management with encrypted local storage.
5. **Modern UI**: Dark mode, glassmorphism, and smooth entrance-driven animations.

## Tech Stack
- **Framework**: Flutter (Material 3)
- **State Management**: Riverpod (Providers)
- **Networking**: Dio (with Interceptors & Error handling)
- **Persistence**: Flutter Secure Storage (High Security AES-256)
- **Typography**: Inter (Google Fonts)
- **Visuals**: Animate_Do & Shimmer effects

## Run Project
1. Install Flutter (latest stable).
2. Run `flutter pub get`.
3. For iOS: `cd ios && pod install && cd ..`.
4. Run with `flutter run`.

## Developer Notes
- API endpoints are pre-configured to `https://www.cambobia.com/api`.
- JWT token is managed automatically by `ApiClient` for all outbound requests.
- Premium theming is centralized in `lib/core/theme.dart`.
