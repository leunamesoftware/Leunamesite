import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
import '../features/shared/notifications_screen.dart';
import '../state/address_controller.dart';
import '../state/auth_controller.dart';
import '../state/cart_controller.dart';
import 'app_logo.dart';

/// Tela padrão da área do cliente: cabeçalho escuro da marca + conteúdo claro arredondado.
class BrandScaffold extends StatelessWidget {
  const BrandScaffold({
    super.key,
    required this.slivers,
    this.title,
    this.subtitle,
    this.showBack = false,
    this.showAddress = false,
    this.search,
    this.headerExtra,
    this.onRefresh,
    this.controller,
    this.bottom,
  });

  final String? title;
  final String? subtitle;
  final bool showBack;
  final bool showAddress;
  final Widget? search;
  final Widget? headerExtra;
  final List<Widget> slivers;
  final Future<void> Function()? onRefresh;
  final ScrollController? controller;
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final header = DecoratedBox(
      decoration: const BoxDecoration(gradient: AppColors.headerGradient),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 36),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 52,
                child: Row(
                  children: [
                    if (showBack)
                      IconButton(
                        tooltip: 'Voltar',
                        onPressed: () => context.canPop() ? context.pop() : context.go('/cliente'),
                        icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                      )
                    else if (context.watch<AuthController>().user != null)
                      const NotificationBell()
                    else
                      const SizedBox(width: 48),
                    const Expanded(child: Center(child: AppLogo(size: 34, nameSize: 21))),
                    const CartButton(),
                  ],
                ),
              ),
              if (title != null) ...[
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(title!, style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                ),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 2, 8, 0),
                    child: Text(subtitle!, style: t.bodyMedium?.copyWith(color: AppColors.textMuted)),
                  ),
              ],
              if (showAddress) ...[const SizedBox(height: 12), const AddressPill()],
              if (search != null) ...[const SizedBox(height: 10), search!],
              if (headerExtra != null) ...[const SizedBox(height: 14), headerExtra!],
            ],
          ),
        ),
      ),
    );

    final scroll = CustomScrollView(
      controller: controller,
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      slivers: [
        SliverToBoxAdapter(child: header),
        SliverToBoxAdapter(
          child: Transform.translate(
            offset: const Offset(0, -24),
            child: Container(
              height: 24,
              decoration: const BoxDecoration(
                color: AppColors.sheet,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
            ),
          ),
        ),
        ...slivers,
        const SliverToBoxAdapter(child: SizedBox(height: 24)),
      ],
    );

    return Theme(
      data: AppTheme.light,
      child: Scaffold(
        backgroundColor: AppColors.sheet,
        body: onRefresh == null
            ? scroll
            : RefreshIndicator(onRefresh: onRefresh!, color: AppColors.primary, child: scroll),
        bottomNavigationBar: bottom,
      ),
    );
  }
}

/// Carrinho com contador no canto do cabeçalho.
class CartButton extends StatelessWidget {
  const CartButton({super.key});

  @override
  Widget build(BuildContext context) {
    final count = context.watch<CartController>().count;
    return IconButton(
      tooltip: count == 0 ? 'Carrinho vazio' : 'Carrinho, $count itens',
      onPressed: () => context.push('/cliente/carrinho'),
      icon: Badge(
        isLabelVisible: count > 0,
        backgroundColor: AppColors.discount,
        label: Text('$count', style: const TextStyle(fontWeight: FontWeight.w700)),
        child: const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 28),
      ),
    );
  }
}

/// "Entregar em …" — abre a confirmação de localização.
class AddressPill extends StatelessWidget {
  const AddressPill({super.key});

  @override
  Widget build(BuildContext context) {
    final a = context.watch<AddressController>().current;
    return Material(
      color: Colors.white.withValues(alpha: .08),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: Colors.white.withValues(alpha: .14)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/cliente/localizacao'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              const Icon(Icons.location_on_rounded, color: AppColors.accent),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Entregar em', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                    Text(
                      a == null
                          ? 'Definir endereço'
                          : [a.line1, if (a.district?.isNotEmpty ?? false) a.district].join(' – '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}

/// Campo de busca claro sobre o cabeçalho. Com [onTap] funciona como atalho (somente leitura).
class HeaderSearchField extends StatelessWidget {
  const HeaderSearchField({
    super.key,
    required this.hint,
    this.onTap,
    this.controller,
    this.onChanged,
    this.onSubmitted,
    this.autofocus = false,
    this.focusNode,
  });

  final String hint;
  final VoidCallback? onTap;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final bool autofocus;
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    const border = OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(28)), borderSide: BorderSide.none);
    return TextField(
      controller: controller,
      focusNode: focusNode,
      readOnly: onTap != null,
      onTap: onTap,
      autofocus: autofocus,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      textInputAction: TextInputAction.search,
      style: const TextStyle(color: AppColors.ink, fontSize: 16),
      cursorColor: AppColors.primary,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.inkMuted, fontSize: 15.5),
        filled: true,
        fillColor: Colors.white,
        prefixIcon: const Icon(Icons.search_rounded, color: AppColors.ink),
        suffixIcon: controller == null
            ? null
            : ListenableBuilder(
                listenable: controller!,
                builder: (_, _) => controller!.text.isEmpty
                    ? const SizedBox.shrink()
                    : IconButton(
                        tooltip: 'Limpar busca',
                        onPressed: () {
                          controller!.clear();
                          onChanged?.call('');
                        },
                        icon: const Icon(Icons.cancel_rounded, color: AppColors.inkMuted),
                      ),
              ),
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
        border: border,
        enabledBorder: border,
        focusedBorder: border,
      ),
    );
  }
}
