package com.hackathonday.migrationhelper;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class MigrationHelperApplication {

	public static void main(String[] args) {
		SpringApplication.run(MigrationHelperApplication.class, args);
	}

}
