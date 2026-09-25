import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../core/config/env.dart';
import '../core/theme/app_colors.dart';

/// Ponto da rota no mapa.
typedef MapStop = ({double lat, double lng, int number, bool done, String name});

/// Mapa da entrega: mercados numerados (ordem de coleta), casa do cliente, entregador e a rota.
class DeliveryMap extends StatelessWidget {
  const DeliveryMap({
    super.key,
    required this.stops,
    required this.home,
    this.courier,
    this.height = 260,
    this.radius = 18,
  });

  final List<MapStop> stops;
  final ({double lat, double lng}) home;
  final ({double lat, double lng})? courier;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final homeP = LatLng(home.lat, home.lng);
    final courierP = courier == null ? null : LatLng(courier!.lat, courier!.lng);
    final pending = stops.where((s) => !s.done).map((s) => LatLng(s.lat, s.lng)).toList();
    final all = [...stops.map((s) => LatLng(s.lat, s.lng)), homeP, ?courierP];
    final route = [?courierP, ...pending, homeP];
    final done = [...stops.where((s) => s.done).map((s) => LatLng(s.lat, s.lng)), ?courierP];
    return Semantics(
      label: 'Mapa da entrega com ${stops.length} ${stops.length == 1 ? 'mercado' : 'mercados'}',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: SizedBox(
          height: height,
          child: FlutterMap(
            options: MapOptions(
              initialCameraFit: CameraFit.coordinates(coordinates: all, padding: const EdgeInsets.all(46), maxZoom: 16),
              interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
            ),
            children: [
              TileLayer(
                urlTemplate: Env.mapTilesUrl,
                userAgentPackageName: 'com.leunamesoftwares.econorota',
                maxZoom: 19,
              ),
              PolylineLayer(
                polylines: [
                  if (done.length > 1) Polyline(points: done, strokeWidth: 4, color: AppColors.success),
                  if (route.length > 1) Polyline(points: route, strokeWidth: 5, color: AppColors.primary),
                ],
              ),
              MarkerLayer(
                markers: [
                  for (final s in stops)
                    Marker(
                      point: LatLng(s.lat, s.lng),
                      width: 40,
                      height: 40,
                      child: Tooltip(
                        message: '${s.number}. ${s.name}',
                        child: _Pin(
                          color: s.done ? AppColors.success : AppColors.primary,
                          child: s.done
                              ? const Icon(Icons.check_rounded, color: Colors.white, size: 18)
                              : Text(
                                  '${s.number}',
                                  style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w800),
                                ),
                        ),
                      ),
                    ),
                  Marker(
                    point: homeP,
                    width: 42,
                    height: 42,
                    child: const Tooltip(
                      message: 'Entrega',
                      child: _Pin(
                        color: AppColors.ink,
                        child: Icon(Icons.home_rounded, color: Colors.white, size: 20),
                      ),
                    ),
                  ),
                  if (courierP != null)
                    Marker(
                      point: courierP,
                      width: 46,
                      height: 46,
                      child: const Tooltip(
                        message: 'Entregador',
                        child: _Pin(
                          color: AppColors.accent,
                          child: Icon(Icons.delivery_dining_rounded, color: AppColors.onAccent),
                        ),
                      ),
                    ),
                ],
              ),
              const Align(
                alignment: Alignment.bottomRight,
                child: Padding(
                  padding: EdgeInsets.all(4),
                  child: ColoredBox(
                    color: Color(0xCCFFFFFF),
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      child: Text('© OpenStreetMap', style: TextStyle(fontSize: 10, color: AppColors.inkMuted)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Pin extends StatelessWidget {
  const _Pin({required this.color, required this.child});

  final Color color;
  final Widget child;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: color,
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 2.5),
      boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 6, offset: Offset(0, 2))],
    ),
    child: Center(child: child),
  );
}
