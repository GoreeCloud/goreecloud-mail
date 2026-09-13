package com.goreecloud.mail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class GlazeMailContractTest {
    @Test
    fun currentStableGlazeReferenceIsPinned() {
        assertEquals("1.4.0", GlazeMailContract.VERSION)
        assertEquals(
            "84cb3db4884042f0fa25ed6d475a127fb110f596",
            GlazeMailContract.REFERENCE_REVISION,
        )
        assertEquals("ADOPTION_IN_PROGRESS", GlazeMailContract.ADOPTION_STATE)
    }

    @Test
    fun nativeOpticalAndHumanAcceptanceRemainFailClosed() {
        assertFalse(GlazeMailContract.OPTICAL_ENGINE_ACCEPTED)
        assertFalse(GlazeMailContract.REDUCED_TRANSPARENCY_ACCEPTED)
        assertFalse(GlazeMailContract.INCREASED_CONTRAST_ACCEPTED)
        assertFalse(GlazeMailContract.PHYSICAL_DEVICE_ACCEPTED)
        assertFalse(GlazeMailContract.HUMAN_VISUAL_ACCEPTED)
    }
}
