package com.familyone.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.*;

@RestController
public class HealthController {
  @GetMapping("/")
  public Map<String,Object> root(){
    return health();
  }
  @GetMapping("/health")
  public Map<String,Object> health(){
    return Map.of("ok", true, "service", "familyone-spring", "now", java.time.Instant.now().toString());
  }
}